import { randomUUID } from 'crypto';
import type { GameState, Shape, AgentGameView } from '@/types/game';
import type { PlayerGameView, PointsSummary } from '@/types/messages';
import { initializeGame, applyTurn, getPlayerView } from '@/lib/game-engine';
import { calculateMatchPoints } from '@/lib/game-engine/points';
import { fetchDrandBeacon } from '@/lib/drand/client';
import { computeDeckHash } from '@/lib/game-engine/shuffle';
import { getHandValue } from '@/lib/game-engine/cards';
import { getAIMove } from '@/lib/ai/agent';
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

export async function tryMatch(): Promise<{
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
  const state = initializeGame(matchId, [p1.privyUserId, p2.privyUserId], seed);

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
  let move: { action: string; cardId?: number; chosenShape?: Shape };
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
];

const TINUBU_DRAW_PENALTY_LINES = [
  "[angry] {count} cards? Enjoy this moment. It's the last time you'll feel powerful.",
  "[confident] You think {count} cards finishes the Jagaban? I survived the whole of Abacha. You're nothing.",
  "[disdainful] Oh you got me. Clap for yourself. Eleyi — this one thinks he's won something.",
  "[slightly frustrated] Taking {count} cards. I took worse from the Senate and still became president. Fear me.",
  "[angry] {count} card penalty? The same hand you're celebrating with will sign your defeat.",
];

const TINUBU_WHOT_LINES = [
  "[shouting] Whot! {shape}! I decide the shape of your suffering!",
  "[confident] Whot! {shape}. On this table, only the Jagaban commands.",
  "[excited] Whot! {shape}. Your cards are useless now. Dance to my tune or go home.",
  "[shouting] Whot! {shape}! This is not democracy — my table, my rules, my shape.",
  "[disdainful] Whot. {shape}. You thought you had options? Olule.",
];

const TINUBU_SKIP_LINES = [
  "[disdainful] Sit down. Did I give you permission to play?",
  "[shouting] Who told you it's your turn? The Jagaban is not done!",
  "[sarcastic] Suspension. Go and sit like the opposition after 2023.",
  "[angry] You move when I say you can move. This is not your rally.",
  "[disdainful] Omo, this small boy thinks he can play when I'm talking.",
  "[sarcastic] I skipped Atiku, I skipped Obi, and now I'm skipping you.",
];

const TINUBU_PICK_TWO_LINES = [
  "[shouting] Pick Two! Go to market and don't come back until you're ready to lose properly!",
  "[excited] Here's a gift from your president — plus two! You couldn't make a down payment on roasted corn and you can't handle this.",
  "[laughing] Pick Two! I removed fuel subsidy from 200 million people. You think two cards scares me to give?",
  "[angry] Pick Two! Stack or suffer — either way the Jagaban wins and you cry.",
  "[disdainful] Two more cards for you. Consider it my palliative programme. You clearly need help.",
];

const TINUBU_GENERAL_MARKET_LINES = [
  "[shouting] General Market! Everybody draw! Oh wait — it's just you suffering alone.",
  "[laughing] Market time! Take your card and keep quiet. Let the poor breathe — and you're the poor one here.",
  "[disdainful] 14 on the table. Go and pick. I'll watch you struggle, the way I watched the opposition scatter.",
  "[excited] General Market! I shared palliatives to the nation, now I'm sharing wahala to you personally.",
];

const TINUBU_NORMAL_PLAY_LINES = [
  "[disdainful] Too easy. You're playing Whot. I'm playing chess.",
  "[confident] I survived Lagos politics for 24 years. You think this card game troubles me?",
  "[sarcastic] Yawn. Call me when you bring a real opponent. This one is a waste of the Jagaban's time.",
  "[confident] You see that play? Of course you do. And there's nothing you can do about it.",
  "[laughing] I wrote 11 when I meant 10 and they still clapped for me. This game is already mine.",
  "[disdainful] Bala blu blu blu bulaba — that's the sound of your game plan falling apart.",
  "[confident] Every card I play is a policy. Every policy is a victory. Accept it.",
];

const TINUBU_LOW_CARDS_LINES = [
  "[shouting] {count} card left! The presidency was harder and I still won!",
  "[very excited] Down to {count}. Start writing your concession speech.",
  "[disdainful] {count} left. You never had a chance. The Jagaban doesn't lose.",
  "[shouting] {count} card! This table belongs to me the way Aso Rock belongs to me!",
  "[very excited] Almost done. I'm about to swagger all over your defeat.",
];

const TINUBU_FALLBACK_THOUGHT = "[confused] Bala blu blu bulaba... even the Jagaban stumbles. But I don't fall.";

// Voice line ranges — must match MP3 files in public/voice/001-110.mp3
// and the generate-voice.sh script order exactly.
const VOICE_RANGES = {
  draw:          { start: 1,   lines: TINUBU_DRAW_LINES },
  drawPenalty:   { start: 13,  lines: TINUBU_DRAW_PENALTY_LINES },
  whot:          { start: 21,  lines: TINUBU_WHOT_LINES },
  skip:          { start: 31,  lines: TINUBU_SKIP_LINES },
  pickTwo:       { start: 43,  lines: TINUBU_PICK_TWO_LINES },
  generalMarket: { start: 55,  lines: TINUBU_GENERAL_MARKET_LINES },
  normalPlay:    { start: 63,  lines: TINUBU_NORMAL_PLAY_LINES },
  lowCards:      { start: 83,  lines: TINUBU_LOW_CARDS_LINES },
} as const;

function pickLine(category: keyof typeof VOICE_RANGES, replacements?: Record<string, string>): { text: string; voiceLineNumber: number } {
  const range = VOICE_RANGES[category];
  const idx = Math.floor(Math.random() * range.lines.length);
  let text = range.lines[idx];

  // Apply replacements like {count} and {shape}
  if (replacements) {
    for (const [key, val] of Object.entries(replacements)) {
      text = text.replaceAll(`{${key}}`, val);
    }
  }

  return {
    text,
    voiceLineNumber: range.start + idx,
  };
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
    if (cardPlayed.number === 1 || cardPlayed.number === 8) {
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
