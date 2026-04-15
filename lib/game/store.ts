import { randomUUID } from 'crypto';
import type { GameState, Shape, AgentGameView } from '@/types/game';
import type { PlayerGameView, PointsSummary } from '@/types/messages';
import { initializeGame, applyTurn, getPlayerView } from '@/lib/game-engine';
import { calculateMatchPoints } from '@/lib/game-engine/points';
import { fetchDrandBeacon } from '@/lib/drand/client';
import { computeDeckHash } from '@/lib/game-engine/shuffle';
import { getHandValue } from '@/lib/game-engine/cards';
import { getAIMove, type AIMove } from '@/lib/ai/agent';
import { logAgentAction, logAgentError, logAgentThoughtTrace } from '@/lib/ai/logger';
import { db } from '@/lib/db';
import { matchmakingQueue, matches, users } from '@/lib/db/schema';
import { desc, eq, or, sql } from 'drizzle-orm';
import { getCurrentSeason, updateSeasonPoints } from '@/lib/seasons/manager';
import { gameEmitter } from '@/lib/ws/emitter';

type MatchRow = typeof matches.$inferSelect;

interface ActiveGame {
  state: GameState;
  drandSeed: string;
  dbMatchId: string;
  points: PointsSummary | null;
  lastAgentThinkMs: number | null;
  lastAgentThought: string | null;
  lastAgentVoiceLine: number | null;
}

export async function joinQueue(userId: string): Promise<{
  status: 'queued' | 'matched';
  matchId?: string;
}> {
  const activeMatch = await findActiveMatchForUser(userId);
  if (activeMatch?.gameMatchId) {
    return {
      status: 'matched',
      matchId: activeMatch.gameMatchId,
    };
  }

  const [existing] = await db
    .select()
    .from(matchmakingQueue)
    .where(eq(matchmakingQueue.privyUserId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(matchmakingQueue).values({ privyUserId: userId });
  }

  return { status: 'queued' };
}

export async function leaveQueue(userId: string): Promise<void> {
  await db.delete(matchmakingQueue).where(eq(matchmakingQueue.privyUserId, userId));
}

export async function getQueueStatus(userId: string): Promise<{
  status: 'idle' | 'queued' | 'matched';
  matchId?: string;
}> {
  const activeMatch = await findActiveMatchForUser(userId);
  if (activeMatch?.gameMatchId) {
    return {
      status: 'matched',
      matchId: activeMatch.gameMatchId,
    };
  }

  const [inQueue] = await db
    .select()
    .from(matchmakingQueue)
    .where(eq(matchmakingQueue.privyUserId, userId))
    .limit(1);

  if (inQueue) return { status: 'queued' };

  return { status: 'idle' };
}

export async function tryMatch(difficulty: import('@/types/game').Difficulty = 'hard'): Promise<{
  matched: boolean;
  matchId?: string;
}> {
  const entries = await db
    .select()
    .from(matchmakingQueue)
    .orderBy(matchmakingQueue.joinedAt)
    .limit(2);

  if (entries.length === 0) return { matched: false };

  if (entries.length === 1 && !isAgent(entries[0].privyUserId)) {
    const agentId = `agent-${randomUUID().slice(0, 8)}`;
    await db.insert(matchmakingQueue).values({ privyUserId: agentId });
    const updated = await db
      .select()
      .from(matchmakingQueue)
      .orderBy(matchmakingQueue.joinedAt)
      .limit(2);
    if (updated.length < 2) return { matched: false };
    entries.length = 0;
    entries.push(...updated);
  }

  if (entries.length < 2) return { matched: false };

  const p1 = entries[0];
  const p2 = entries[1];

  await db.delete(matchmakingQueue).where(eq(matchmakingQueue.privyUserId, p1.privyUserId));
  await db.delete(matchmakingQueue).where(eq(matchmakingQueue.privyUserId, p2.privyUserId));

  let seed: string;
  try {
    const beacon = await fetchDrandBeacon();
    seed = beacon.randomness;
  } catch {
    seed = randomUUID();
  }

  const matchId = randomUUID();
  const state = initializeGame(matchId, [p1.privyUserId, p2.privyUserId], seed, difficulty);

  await db.insert(matches).values({
    gameMatchId: matchId,
    player1Id: p1.privyUserId,
    player2Id: p2.privyUserId,
    status: 'active',
    drandSeed: seed,
    gameState: state,
  });

  gameEmitter.emitQueueMatched({
    matchId,
    playerIds: [p1.privyUserId, p2.privyUserId],
  });

  return { matched: true, matchId };
}

function isAgent(userId: string): boolean {
  return userId.startsWith('agent-');
}

export async function getGameState(matchId: string, userId: string): Promise<{
  view: PlayerGameView;
  points: PointsSummary | null;
  contractMatchId: null;
  resultTxHash: null;
} | null> {
  return withMatchLock(matchId, async (tx) => {
    const row = await findMatchByGameId(matchId, tx);
    if (!row) return null;

    const game = toActiveGame(row);
    if (!game) return null;
    if (!game.state.playerOrder.includes(userId)) return null;

    if (game.state.status === 'active') {
      let safety = 0;
      while (safety++ < 10) {
        const currentPlayer = game.state.playerOrder[game.state.currentPlayerIndex];
        if (!isAgent(currentPlayer) || game.state.status !== 'active') break;
        await tickAgentTurn(game, currentPlayer, tx);
      }
    }

    return buildGameStateResponse(game, userId);
  });
}

async function tickAgentTurn(game: ActiveGame, agentId: string, tx: DbExecutor): Promise<void> {
  const state = game.state;
  const hand = state.hands[agentId];
  if (!hand || hand.length === 0) return;

  const matchId = game.state.matchId;
  let move: AIMove;
  const thinkStart = Date.now();
  try {
    move = await getAIMove(buildAgentView(game.state, agentId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logAgentError(matchId, agentId, `AI move failed: ${errMsg}`);
    console.warn(`[Agent] AI move failed, falling back to draw:`, errMsg);
    move = { action: 'draw' };
  }
  game.lastAgentThinkMs = Date.now() - thinkStart;

  try {
    const cardPlayed = move.cardId !== undefined
      ? state.hands[agentId]?.find((c) => c.id === move.cardId)
      : undefined;
    const detail = move.action === 'play' && cardPlayed
      ? `Played ${cardPlayed.shape} ${cardPlayed.number} [id:${cardPlayed.id}]${move.chosenShape ? ` (called ${move.chosenShape})` : ''}`
      : `Drew from market (pending: ${state.pendingDraws})`;

    const topCard = state.discardPile[state.discardPile.length - 1];
    const { text: thoughtText, voiceLineNumber } = buildAgentThought(move, cardPlayed ?? null, topCard, hand, state);
    game.lastAgentThought = thoughtText;
    game.lastAgentVoiceLine = voiceLineNumber;
    logAgentThoughtTrace(matchId, agentId, thoughtText, game.lastAgentThinkMs ?? 0);

    // Apply the move and persist — card hits the table immediately
    switch (move.action) {
      case 'play':
        game.state = applyTurn(state, agentId, {
          type: 'play',
          cardId: move.cardId!,
          chosenShape: move.chosenShape,
        });
        logAgentAction(matchId, agentId, 'play', true, detail);
        await persistTurnOutcome(game, tx);
        break;
      case 'draw':
        // Rigged mode: cherry-pick the best card from the entire deck
        if (game.state.difficulty === 'rigged' && game.state.deck.length > 0) {
          rigMarketDraw(game.state);
        }
        game.state = applyTurn(state, agentId, { type: 'draw' });
        logAgentAction(matchId, agentId, 'draw', true, detail);
        await persistTurnOutcome(game, tx);
        break;
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logAgentError(matchId, agentId, `Move "${move.action}" invalid: ${errMsg} — falling back to draw`);
    console.warn(`[Agent] Move "${move.action}" invalid, falling back to draw:`, errMsg);
    game.lastAgentThought = TINUBU_FALLBACK_THOUGHT;
    game.lastAgentVoiceLine = 1; // fallback: first draw line
    logAgentThoughtTrace(matchId, agentId, game.lastAgentThought, game.lastAgentThinkMs ?? 0);

    // Only attempt fallback draw if the game is still active
    if (game.state.status === 'active') {
      try {
        game.state = applyTurn(state, agentId, { type: 'draw' });
        logAgentAction(matchId, agentId, 'draw (fallback)', true, 'Fallback after invalid move');
        await persistTurnOutcome(game, tx);
      } catch (fallbackErr) {
        logAgentError(matchId, agentId, `Fallback draw also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
      }
    }
  }
}

// ── Tinubu's trash talk lines, categorized by game situation ──
// Each line includes Fish Audio emotion tags for expressive TTS.

const TINUBU_DRAW_LINES = [
  "[calm] I'm going to market, not running from you. Know the difference.",
  "[confident] Even Obasanjo had to take losses before I put him back in his place. Relax.",
  "[disdainful] You think this means something? I built Lagos from nothing. One card means nothing.",
  "[confident] I went to market and came back as president. You go to market and come back with nothing.",
  "[calm] A dead fish cannot be sweet in any soup — but you? You're not even in the kitchen.",
  "[sarcastic] Is it for eba? Is it for garri? No — it's for watching you lose slowly.",
  "[confident] They said I was finished in 2003. Then 2007. Then 2015. Look at me now. Drawing one card won't kill the Jagaban.",
  // batch 2
  "[disdainful] You think I'm struggling? Omo I built Lagos while drawing worse cards than this.",
  "[angry] I drew one card. You drew the short straw in life. We are not the same.",
  "[sarcastic] Clap for yourself — you forced one draw. Meanwhile I'm planning your burial.",
  "[disdainful] Abeg, even when I draw I'm still better than you playing your best card.",
  "[angry] I went to market and I'll come back with your head on a plate.",
  "[sarcastic] You're excited because I drew? Small wins for small people.",
  "[disdainful] One draw and you think you're winning? You don't know who you're playing against.",
  "[angry] Na market I go. Na your grave I dey dig when I come back.",
  "[sarcastic] Keep smiling about my draw. Your smile will disappear when I play next.",
  "[disdainful] Drawing from market doesn't scare me. Your yeye cards scare me more.",
];

const TINUBU_DRAW_PENALTY_LINES = [
  "[angry] {count} cards? Enjoy this moment. It's the last time you'll feel powerful.",
  "[confident] You think {count} cards finishes the Jagaban? I survived the whole of Abacha. You're nothing.",
  "[disdainful] Oh you got me. Clap for yourself. Eleyi — this one thinks he's won something.",
  "[slightly frustrated] Taking {count} cards. I took worse from the Senate and still became president. Fear me.",
  "[angry] {count} card penalty? The same hand you're celebrating with will sign your defeat.",
  // batch 2
  "[angry] {count} cards? Omo, enjoy it. This is the last happiness you'll feel today.",
  "[shouting] {count} cards and you think it's over? I ate worse for breakfast in Lagos politics!",
  "[angry] You gave me {count} cards. I'll give you {count} reasons to cry when I play next.",
  "[disdainful] {count} penalty? Abeg. I've been stabbed by senators — your cards are nothing.",
  "[angry] Taking {count} cards. The same way I took the presidency — with anger and patience.",
  "[shouting] {count} cards? Wetin? You think say na this go finish the Jagaban? You dey ment!",
];

const TINUBU_WHOT_LINES = [
  "[shouting] Whot! {shape}! I decide the shape of your suffering!",
  "[confident] Whot! {shape}. On this table, only the Jagaban commands.",
  "[excited] Whot! {shape}. Your cards are useless now. Dance to my tune or go home.",
  "[shouting] Whot! {shape}! This is not democracy — my table, my rules, my shape.",
  "[disdainful] Whot. {shape}. You thought you had options? Olule.",
  // batch 2
  "[shouting] Whot! {shape}! Your hand is dead! Everything you're holding is useless now!",
  "[angry] Whot! {shape}! I just ended your whole career with one card. Shurrup and draw!",
  "[shouting] Whot! {shape}! Try and match that. I dare you. You can't!",
  "[disdainful] Whot! {shape}. Olule! Your cards are trash and you know it.",
  "[shouting] Whot! {shape}! I chose the one shape you don't have. How does it feel?",
  "[angry] Whot! {shape}! Na me be god of this table. Bow down or go to market!",
  "[shouting] Whot! {shape}! You're finished! Go and draw from market like the loser you are!",
  "[disdainful] Whot! {shape}. I picked the shape you're weakest in. Intentionally. Suffer.",
];

const TINUBU_SKIP_LINES = [
  "[disdainful] Sit down. Did I give you permission to play?",
  "[shouting] Who told you it's your turn? The Jagaban is not done!",
  "[sarcastic] Suspension. Go and sit like the opposition after 2023.",
  "[angry] You move when I say you can move. This is not your rally.",
  "[disdainful] Omo, this small boy thinks he can play when I'm talking.",
  "[sarcastic] I skipped Atiku, I skipped Obi, and now I'm skipping you.",
  // batch 2
  "[shouting] Shurrup and sit down! Nobody asked you to play!",
  "[disdainful] You thought it was your turn? Omo you're delusional.",
  "[angry] Skip! Your turn got cancelled like fuel subsidy. Nobody cares about your feelings!",
  "[shouting] Na my table! Touch those cards again and I'll skip you twice!",
  "[disdainful] Oya rest joor. You're not important enough to play right now.",
  "[angry] Hold on! Did I tell you to move? Sit there like the errand boy you are!",
  "[shouting] Your turn? Which turn? I don't see your name on this table!",
  "[disdainful] Abeg park well. Small boy like you wan play when Jagaban dey talk?",
  "[angry] You dey craze? Who gave you permission? Siddon there!",
  "[shouting] I skipped your turn the way I skip questions at press conferences. Easily.",
];

const TINUBU_PICK_TWO_LINES = [
  "[shouting] Pick Two! Go to market and don't come back until you're ready to lose properly!",
  "[excited] Here's a gift from your president — plus two! You couldn't make a down payment on roasted corn and you can't handle this.",
  "[laughing] Pick Two! I removed fuel subsidy from 200 million people. You think two cards scares me to give?",
  "[angry] Pick Two! Stack or suffer — either way the Jagaban wins and you cry.",
  "[disdainful] Two more cards for you. Consider it my palliative programme. You clearly need help.",
  // batch 2
  "[shouting] Pick Two! Swallow that! The Jagaban is feeding you cards by force!",
  "[laughing] Plus two! You're drowning in cards and I'm laughing at you from the shore!",
  "[angry] Pick Two! Go to market and come back when you've learned your place!",
  "[excited] Two cards! Your hand is getting fatter than a senator's bank account!",
  "[shouting] Pick Two! I generated wahala for 200 million people — two cards for you is mercy!",
  "[disdainful] Take two more. Your hand is so full it's embarrassing. Carry your cross!",
  "[angry] Pick Two! Na me dey share the national punishment and you're the only citizen!",
  "[laughing] Plus two! You're collecting cards like INEC collects ballot papers — plenty and useless!",
  "[shouting] Two cards! Chop am! The Jagaban doesn't do small punishments!",
  "[angry] Pick Two! Your cards are piling up like complaints against my government. Nobody cares!",
];

const TINUBU_GENERAL_MARKET_LINES = [
  "[shouting] General Market! Everybody draw! Oh wait — it's just you suffering alone.",
  "[laughing] Market time! Take your card and keep quiet. Let the poor breathe — and you're the poor one here.",
  "[disdainful] 14 on the table. Go and pick. I'll watch you struggle, the way I watched the opposition scatter.",
  "[excited] General Market! I shared palliatives to the nation, now I'm sharing wahala to you personally.",
  // batch 2
  "[shouting] General Market! Go and pick! I'm adding to your suffering for free!",
  "[laughing] Market! Have a card. Consider it your severance package because this game is over for you!",
  "[angry] General Market! You thought you were safe? Nobody is safe from the Jagaban!",
  "[disdainful] 14! Go draw. Your hand wasn't embarrassing enough so I made it worse!",
  "[shouting] General Market! I shared pain to the nation — now I'm sharing it to you personally!",
  "[angry] Market! Oya go pick! Quick quick! Don't waste the Jagaban's time!",
];

const TINUBU_NORMAL_PLAY_LINES = [
  "[disdainful] Too easy. You're playing Whot. I'm playing chess.",
  "[confident] I survived Lagos politics for 24 years. You think this card game troubles me?",
  "[sarcastic] Yawn. Call me when you bring a real opponent. This one is a waste of the Jagaban's time.",
  "[confident] You see that play? Of course you do. And there's nothing you can do about it.",
  "[laughing] I wrote 11 when I meant 10 and they still clapped for me. This game is already mine.",
  "[disdainful] Bala blu blu blu bulaba — that's the sound of your game plan falling apart.",
  "[confident] Every card I play is a policy. Every policy is a victory. Accept it.",
  // batch 2
  "[disdainful] Wetin you go do? Absolutely nothing. You're useless at this table.",
  "[angry] You dey look me like say you get chance? Omo you don't have chance!",
  "[laughing] Bala blu blu bulaba — that's what your whole game sounds like. Nonsense!",
  "[disdainful] You're a preliminary man playing a professional's game. Know your level.",
  "[sarcastic] Shey you think you're playing well? You're playing yourself!",
  "[angry] Sit there and watch me win. Your opinion doesn't matter here.",
  "[laughing] I said shurrup! Did I stutter? Every card I play shuts you up more!",
  "[disdainful] Omo, you're still trying? Respect yourself and forfeit abeg.",
  "[angry] Na dictatorship of the Jagaban at this table. Your democracy ended when I sat down.",
  "[sarcastic] Your face right now is funnier than my bala blu blu speech. Pure confusion!",
  "[disdainful] Playing me became a source of pain for you. Accept it and move on.",
  "[angry] Every card I drop is a slap to your strategy. And you can't slap back!",
  "[shouting] You're not even competition! You're entertainment for the Jagaban!",
  "[disdainful] Your cards are shaking. Your hands are shaking. Your whole game is shaking.",
  "[sarcastic] Na cruise for me. Na funeral for you. We are not the same!",
  "[angry] I'm not playing cards — I'm teaching you a lesson you'll never forget!",
  "[laughing] You thought you came here to win? You came here to be humiliated!",
  "[disdainful] Mumu! Even your best play looks like my worst play. Levels!",
  "[angry] I use the best hand and the best brain. You use rubbish and vibes. No wonder you're losing.",
  "[shouting] Another card! Another nail in your coffin! The Jagaban doesn't stop!",
];

const TINUBU_LOW_CARDS_LINES = [
  "[shouting] {count} card left! The presidency was harder and I still won!",
  "[very excited] Down to {count}. Start writing your concession speech.",
  "[disdainful] {count} left. You never had a chance. The Jagaban doesn't lose.",
  "[shouting] {count} card! This table belongs to me the way Aso Rock belongs to me!",
  "[very excited] Almost done. I'm about to swagger all over your defeat.",
  // batch 2
  "[shouting] {count} card left! It's over! Your game is dead and I killed it!",
  "[very excited] Down to {count}! Start crying! The Jagaban is about to finish you!",
  "[angry] {count} left! You never had a chance against me. Not once. Not ever!",
  "[shouting] {count} remaining! This is your funeral and I'm the priest!",
  "[very excited] Almost done! Your destruction was the easiest thing I've done all day!",
  "[angry] {count} left! Even Obasanjo couldn't stop me. You? You're a joke!",
  "[shouting] {count} card! Pack your bags! The Jagaban is closing this game NOW!",
  "[very excited] Game's done! You trusted your cards — your cards betrayed you like my opposition!",
];

const TINUBU_FALLBACK_THOUGHT = "[confused] Bala blu blu bulaba... even the Jagaban stumbles. But I don't fall.";

// Voice line mappings — each array entry has the text + its MP3 file number.
// Batch 1: 001-110, Batch 2: 111-204.
const VOICE_MAP = {
  draw:          buildVoiceMap(TINUBU_DRAW_LINES,          [1,2,3,4,5,6,7, 111,112,113,114,115,116,117,118,119,120]),
  drawPenalty:   buildVoiceMap(TINUBU_DRAW_PENALTY_LINES,  [13,14,15,16,17, 121,122,123,124,125,126]),
  whot:          buildVoiceMap(TINUBU_WHOT_LINES,          [21,22,23,24,25, 127,128,129,130,131,132,133,134]),
  skip:          buildVoiceMap(TINUBU_SKIP_LINES,          [31,32,33,34,35,36, 135,136,137,138,139,140,141,142,143,144]),
  pickTwo:       buildVoiceMap(TINUBU_PICK_TWO_LINES,      [43,44,45,46,47, 145,146,147,148,149,150,151,152,153,154]),
  generalMarket: buildVoiceMap(TINUBU_GENERAL_MARKET_LINES,[55,56,57,58, 155,156,157,158,159,160]),
  normalPlay:    buildVoiceMap(TINUBU_NORMAL_PLAY_LINES,   [63,64,65,66,67,68,69, 161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180]),
  lowCards:      buildVoiceMap(TINUBU_LOW_CARDS_LINES,     [83,84,85,86,87, 181,182,183,184,185,186,187,188]),
};

function buildVoiceMap(lines: string[], mp3Numbers: number[]): Array<{ text: string; mp3: number }> {
  return lines.map((text, i) => ({ text, mp3: mp3Numbers[i] }));
}

function pickLine(category: keyof typeof VOICE_MAP, replacements?: Record<string, string>): { text: string; voiceLineNumber: number } {
  const entries = VOICE_MAP[category];
  const entry = entries[Math.floor(Math.random() * entries.length)];
  let text = entry.text;

  if (replacements) {
    for (const [key, val] of Object.entries(replacements)) {
      text = text.replaceAll(`{${key}}`, val);
    }
  }

  return { text, voiceLineNumber: entry.mp3 };
}

function buildAgentThought(
  move: { action: string; cardId?: number; chosenShape?: Shape },
  cardPlayed: { shape: string; number: number } | null,
  topCard: { shape: string; number: number },
  hand: { shape: string; number: number }[],
  state: GameState
): { text: string; voiceLineNumber: number } {
  if (move.action === 'draw') {
    if (state.pendingDraws > 0) {
      return pickLine('drawPenalty', { count: String(state.pendingDraws) });
    }
    return pickLine('draw');
  }

  if (move.action === 'play' && cardPlayed) {
    if (cardPlayed.shape === 'whot') {
      return pickLine('whot', { shape: move.chosenShape ?? 'circle' });
    }
    if (cardPlayed.number === 1) {
      return pickLine('skip');
    }
    if (cardPlayed.number === 2) {
      return pickLine('pickTwo');
    }
    if (cardPlayed.number === 14) {
      return pickLine('generalMarket');
    }

    const remaining = hand.length - 1;
    if (remaining <= 2 && remaining > 0) {
      return pickLine('lowCards', { count: String(remaining) });
    }

    return pickLine('normalPlay');
  }

  return pickLine('normalPlay');
}

/**
 * Rigged mode: scan the entire deck and swap the best card to the top.
 * The AI "draws" this card next since deck.pop() takes from the end.
 *
 * Priority: Whot > Pick Two > Hold On > General Market > shape match > number match > highest number
 */
function rigMarketDraw(state: GameState): void {
  const deck = state.deck;
  if (deck.length === 0) return;

  const topCard = state.discardPile[state.discardPile.length - 1];
  const activeShape = state.activeShape;
  const agentId = state.playerOrder[state.currentPlayerIndex];
  const agentHand = state.hands[agentId];

  // Score every card in the deck — higher = better for the agent
  let bestIdx = deck.length - 1; // default: top of deck
  let bestScore = -Infinity;

  for (let i = 0; i < deck.length; i++) {
    const card = deck[i];
    let score = 0;

    // Whot card = best possible draw, but not if agent already has one (too obvious)
    if (card.shape === 'whot') {
      const alreadyHasWhot = agentHand.some((c) => c.shape === 'whot');
      score += alreadyHasWhot ? 30 : 200; // downgrade if already holding one
    }

    // Special cards are high value
    if (card.number === 2) score += 150;  // Pick Two
    if (card.number === 1) score += 120;  // Hold On
    if (card.number === 14) score += 100; // General Market

    // Playable immediately = bonus (matches current top card)
    const matchesShape = activeShape
      ? card.shape === activeShape
      : card.shape === topCard.shape;
    const matchesNumber = card.number === topCard.number;

    if (matchesShape || matchesNumber) {
      score += 80; // can play this card next turn
    }

    // Cards that connect with existing hand = bonus
    for (const handCard of agentHand) {
      if (handCard.shape === card.shape && card.shape !== 'whot') score += 5;
      if (handCard.number === card.number) score += 3;
    }

    // Higher number cards are slightly better (more points if opponent holds them)
    score += card.number * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // Swap the best card to the top of the deck (end of array = drawn next)
  if (bestIdx !== deck.length - 1) {
    const temp = deck[deck.length - 1];
    deck[deck.length - 1] = deck[bestIdx];
    deck[bestIdx] = temp;
  }
}

function buildAgentView(state: GameState, agentId: string): AgentGameView {
  const raw = getPlayerView(state, agentId) as Record<string, unknown>;
  const opponentId = state.playerOrder.find((id) => id !== agentId) ?? '';
  return {
    matchId: raw.matchId as string,
    myHand: raw.myHand as AgentGameView['myHand'],
    opponentCardCount: raw.opponentCardCount as number,
    topCard: raw.topCard as AgentGameView['topCard'],
    deckSize: raw.deckSize as number,
    activeShape: raw.activeShape as AgentGameView['activeShape'],
    pendingDraws: raw.pendingDraws as number,
    pendingDrawType: raw.pendingDrawType as AgentGameView['pendingDrawType'],
    currentPlayerId: raw.currentPlayerId as string,
    isMyTurn: true,
    turnCount: raw.turnCount as number,
    status: raw.status as AgentGameView['status'],
    winner: raw.winner as string | null,
    // Agent-only fields
    discardPile: state.discardPile,
    turnLog: state.log,
    opponentId,
    opponentHand: state.difficulty === 'rigged' ? (state.hands[opponentId] ?? null) : null,
    difficulty: state.difficulty ?? 'hard',
  };
}

export async function playCard(
  matchId: string,
  userId: string,
  cardId: number,
  chosenShape?: Shape
): Promise<{ success: boolean; error?: string }> {
  // Short lock: apply and persist the player's move only
  const result = await withMatchLock(matchId, async (tx) => {
    const game = await loadGameForAction(matchId, tx);
    if (!game) return { success: false as const, error: 'Game not found' };
    if (game.state.status !== 'active') return { success: false as const, error: 'Game is not active' };

    try {
      game.state = applyTurn(game.state, userId, {
        type: 'play',
        cardId,
        chosenShape,
      });
      await persistTurnOutcome(game, tx);
      broadcastGameState(game);
      return { success: true as const, needsAgent: needsAgentTurn(game) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Invalid move' };
    }
  });

  // Agent AI work runs outside the DB lock, then re-locks briefly to persist
  if (result.success && result.needsAgent) {
    await runAgentTurnsSeparate(matchId);
  }

  return result;
}

export async function drawCard(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Short lock: apply and persist the player's draw only
  const result = await withMatchLock(matchId, async (tx) => {
    const game = await loadGameForAction(matchId, tx);
    if (!game) return { success: false as const, error: 'Game not found' };
    if (game.state.status !== 'active') return { success: false as const, error: 'Game is not active' };

    try {
      game.state = applyTurn(game.state, userId, { type: 'draw' });
      await persistTurnOutcome(game, tx);
      broadcastGameState(game);
      return { success: true as const, needsAgent: needsAgentTurn(game) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Invalid move' };
    }
  });

  // Agent AI work runs outside the DB lock, then re-locks briefly to persist
  if (result.success && result.needsAgent) {
    await runAgentTurnsSeparate(matchId);
  }

  return result;
}

export async function forfeitGame(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return withMatchLock(matchId, async (tx) => {
    const game = await loadGameForAction(matchId, tx);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.state.status !== 'active') return { success: false, error: 'Game is not active' };
    if (!game.state.playerOrder.includes(userId)) return { success: false, error: 'Not a player in this game' };

    const opponentId = game.state.playerOrder.find((id) => id !== userId)!;
    game.state.winner = opponentId;
    game.state.status = 'finished';

    await finalizeGame(game, tx);
    broadcastGameState(game);
    return { success: true };
  });
}

function needsAgentTurn(game: ActiveGame): boolean {
  if (game.state.status !== 'active') return false;
  const currentPlayer = game.state.playerOrder[game.state.currentPlayerIndex];
  return isAgent(currentPlayer);
}

/**
 * Run agent turns synchronously (awaited) but in a separate DB transaction.
 * AI compute (MCTS, LLM trash talk) happens outside the lock.
 * Only the final persist step re-acquires the lock briefly.
 */
async function runAgentTurnsSeparate(matchId: string): Promise<void> {
  try {
    await withMatchLock(matchId, async (tx) => {
      const game = await loadGameForAction(matchId, tx);
      if (!game || game.state.status !== 'active') return;

      let safety = 0;
      while (safety++ < 10) {
        const currentPlayer = game.state.playerOrder[game.state.currentPlayerIndex];
        if (!isAgent(currentPlayer) || game.state.status !== 'active') break;
        await tickAgentTurn(game, currentPlayer, tx);
        broadcastGameState(game);
      }
    });
  } catch (err) {
    console.error(`[Agent] Agent turn failed for ${matchId}:`, err);
  }
}

async function persistTurnOutcome(game: ActiveGame, tx: DbExecutor): Promise<void> {
  if (game.state.status === 'finished') {
    await finalizeGame(game, tx);
    return;
  }

  await persistActiveGameState(game, tx);
}

async function finalizeGame(game: ActiveGame, tx: DbExecutor): Promise<void> {
  const winnerId = game.state.winner!;
  const loserId = game.state.playerOrder.find((id) => id !== winnerId)!;
  const loserHand = game.state.hands[loserId];

  const points = calculateMatchPoints(
    winnerId,
    loserId,
    loserHand,
    game.state.turnCount,
    0
  );

  game.points = {
    winnerPoints: points.winnerPoints,
    loserPoints: points.loserPoints,
    basePoints: points.basePoints,
    dominanceBonus: points.dominanceBonus,
    speedBonus: points.speedBonus,
    streakMultiplier: points.streakMultiplier,
  };

  await persistFinishedMatch(game, points, tx);

  try {
    const season = await getCurrentSeason();
    const winnerUuid = await getUserUuidByPrivyId(winnerId);
    const loserUuid = await getUserUuidByPrivyId(loserId);

    if (winnerUuid) {
      await updateSeasonPoints(season.id, winnerUuid, points.winnerPoints, true);
    }
    if (loserUuid) {
      await updateSeasonPoints(season.id, loserUuid, points.loserPoints, false);
    }
  } catch (err) {
    console.error(`[Season] Failed to update season points for ${game.state.matchId}:`, err);
  }
}

async function persistActiveGameState(game: ActiveGame, tx: DbExecutor): Promise<void> {
  await tx
    .update(matches)
    .set({
      gameState: game.state,
      turnsTaken: game.state.turnCount,
      lastAgentThought: game.lastAgentThought,
      lastAgentThinkMs: game.lastAgentThinkMs,
      lastAgentVoiceLine: game.lastAgentVoiceLine,
    })
    .where(eq(matches.id, game.dbMatchId));
}

async function persistFinishedMatch(
  game: ActiveGame,
  points: ReturnType<typeof calculateMatchPoints>,
  tx: DbExecutor
): Promise<void> {
  const winnerId = game.state.winner!;
  const loserId = game.state.playerOrder.find((id) => id !== winnerId)!;
  const loserHand = game.state.hands[loserId];
  const deckHash = await computeDeckHash(game.state.deck);

  await tx
    .update(matches)
    .set({
      winnerId,
      status: 'finished',
      gameState: game.state,
      deckHash,
      turnsTaken: game.state.turnCount,
      loserPenaltyScore: getHandValue(loserHand),
      winnerPoints: points.winnerPoints,
      loserPoints: points.loserPoints,
    })
    .where(eq(matches.id, game.dbMatchId));
}

export async function getUserMatches(userId: string) {
  return db
    .select()
    .from(matches)
    .where(or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)))
    .orderBy(desc(matches.createdAt))
    .limit(50);
}

export async function markMatchClaimed(matchId: string): Promise<void> {
  await db
    .update(matches)
    .set({ claimed: true })
    .where(eq(matches.id, matchId));
}

export async function getStats() {
  const active = await db
    .select()
    .from(matches)
    .where(eq(matches.status, 'active'));

  return { activeGames: active.length };
}

async function loadGameForAction(matchId: string, tx: DbExecutor): Promise<ActiveGame | null> {
  const row = await findMatchByGameId(matchId, tx);
  if (!row) return null;
  return toActiveGame(row);
}

async function findMatchByGameId(matchId: string, tx: DbExecutor = db): Promise<MatchRow | null> {
  const [row] = await tx
    .select()
    .from(matches)
    .where(eq(matches.gameMatchId, matchId))
    .limit(1);

  return row ?? null;
}

async function findActiveMatchForUser(userId: string): Promise<MatchRow | null> {
  const activeRows = await db
    .select()
    .from(matches)
    .where(or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)))
    .orderBy(desc(matches.createdAt))
    .limit(10);

  return (
    activeRows.find((row) =>
      row.status === 'active' &&
      !!row.gameMatchId &&
      !!row.gameState &&
      isGameState(row.gameState)
    ) ?? null
  );
}

function toActiveGame(row: MatchRow): ActiveGame | null {
  if (!row.gameState || !isGameState(row.gameState)) return null;

  return {
    state: row.gameState,
    drandSeed: row.drandSeed ?? '',
    dbMatchId: row.id,
    points: buildPointsSummary(row),
    lastAgentThinkMs: row.lastAgentThinkMs ?? null,
    lastAgentThought: row.lastAgentThought ?? null,
    lastAgentVoiceLine: row.lastAgentVoiceLine ?? null,
  };
}

function broadcastGameState(game: ActiveGame) {
  const views: Record<string, {
    view: PlayerGameView;
    points: PointsSummary | null;
    lastAgentThinkMs: number | null;
    lastAgentThought: string | null;
    lastAgentVoiceLine: number | null;
  }> = {};

  for (const playerId of game.state.playerOrder) {
    const resp = buildGameStateResponse(game, playerId);
    views[playerId] = {
      view: resp.view,
      points: resp.points,
      lastAgentThinkMs: resp.lastAgentThinkMs,
      lastAgentThought: resp.lastAgentThought,
      lastAgentVoiceLine: resp.lastAgentVoiceLine,
    };
  }

  gameEmitter.emitGameState({
    matchId: game.state.matchId,
    views,
  });
}

function buildGameStateResponse(game: ActiveGame, userId: string) {
  const raw = getPlayerView(game.state, userId) as Record<string, unknown>;
  const view: PlayerGameView = {
    matchId: raw.matchId as string,
    myHand: raw.myHand as PlayerGameView['myHand'],
    opponentCardCount: raw.opponentCardCount as number,
    topCard: raw.topCard as PlayerGameView['topCard'],
    deckSize: raw.deckSize as number,
    activeShape: raw.activeShape as PlayerGameView['activeShape'],
    pendingDraws: raw.pendingDraws as number,
    pendingDrawType: raw.pendingDrawType as PlayerGameView['pendingDrawType'],
    currentPlayerId: raw.currentPlayerId as string,
    isMyTurn: raw.isMyTurn as boolean,

    turnCount: raw.turnCount as number,
    status: raw.status as PlayerGameView['status'],
    winner: raw.winner as string | null,
  };

  return {
    view,
    points: game.points,
    contractMatchId: null,
    resultTxHash: null,
    lastAgentThinkMs: game.lastAgentThinkMs,
    lastAgentThought: game.lastAgentThought,
    lastAgentVoiceLine: game.lastAgentVoiceLine,
  };
}

function buildPointsSummary(row: MatchRow): PointsSummary | null {
  if (row.winnerPoints === null || row.loserPoints === null) return null;

  const loserPenalty = row.loserPenaltyScore ?? 0;
  const dominanceBonus = Math.min(60, loserPenalty);
  const basePoints = 100;
  const speedBonus = Math.max(0, row.winnerPoints - basePoints - dominanceBonus);

  return {
    winnerPoints: row.winnerPoints,
    loserPoints: row.loserPoints,
    basePoints,
    dominanceBonus,
    speedBonus,
    streakMultiplier: 1,
  };
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.matchId === 'string' &&
    Array.isArray(record.playerOrder) &&
    typeof record.currentPlayerIndex === 'number' &&
    Array.isArray(record.discardPile) &&
    Array.isArray(record.deck)
  );
}

async function getUserUuidByPrivyId(privyId: string): Promise<string | null> {
  if (isAgent(privyId)) return null;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1);

  return user?.id ?? null;
}

type DbExecutor = typeof db;

async function withMatchLock<T>(
  matchId: string,
  work: (tx: DbExecutor) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`);
    return work(tx as unknown as DbExecutor);
  });
}
