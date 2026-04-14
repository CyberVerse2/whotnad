import { randomUUID } from 'crypto';
import type { GameState, Shape } from '@/types/game';
import type { PlayerGameView, PointsSummary } from '@/types/messages';
import { initializeGame, applyTurn, getPlayerView } from '@/lib/game-engine';
import { calculateMatchPoints } from '@/lib/game-engine/points';
import { fetchDrandBeacon } from '@/lib/drand/client';
import { computeDeckHash } from '@/lib/game-engine/shuffle';
import { getHandValue } from '@/lib/game-engine/cards';
import { getAIMove } from '@/lib/ai/agent';
import { getTinubuTrashTalk } from '@/lib/ai/strategy';
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
    const agentView = buildAgentView(game.state, agentId);
    const llmThought = await getTinubuTrashTalk(agentView, move, cardPlayed ?? null);
    game.lastAgentThought = llmThought ?? buildAgentThought(move, cardPlayed ?? null, topCard, hand, state);
    logAgentThoughtTrace(matchId, agentId, game.lastAgentThought, game.lastAgentThinkMs ?? 0);

    switch (move.action) {
      case 'play':
        game.state = applyTurn(state, agentId, {
          type: 'play',
          cardId: move.cardId!,
          chosenShape: move.chosenShape,
        });
        logAgentAction(matchId, agentId, 'play', true, detail);
        await persistTurnOutcome(game, tx);
        return;
      case 'draw':
        game.state = applyTurn(state, agentId, { type: 'draw' });
        logAgentAction(matchId, agentId, 'draw', true, detail);
        await persistTurnOutcome(game, tx);
        return;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logAgentError(matchId, agentId, `Move "${move.action}" invalid: ${errMsg} — falling back to draw`);
    console.warn(`[Agent] Move "${move.action}" invalid, falling back to draw:`, errMsg);
    game.lastAgentThought = TINUBU_FALLBACK_THOUGHT;
    logAgentThoughtTrace(matchId, agentId, game.lastAgentThought, game.lastAgentThinkMs ?? 0);
    game.state = applyTurn(state, agentId, { type: 'draw' });
    logAgentAction(matchId, agentId, 'draw (fallback)', true, 'Fallback after invalid move');
    await persistTurnOutcome(game, tx);
  }
}

// ── Tinubu's trash talk lines, categorized by game situation ──
// Each line includes Fish Audio emotion tags for expressive TTS.

const TINUBU_DRAW_LINES = [
  "[calm] Even the Jagaban goes to market sometimes. It's called strategy.",
  "[calm] I'm drawing a card, not retreating. A common screwdriver can create a path to fortune.",
  "[confident] Relax, this is all part of the plan. Emi lokan — it's still my turn.",
  "[calm] No matter how short you are, you get out, you will see the sky. I'll draw and still win.",
  "[confident] Drawing from market is not defeat. A dead fish cannot be sweet in any soup — but I'm very much alive.",
  "[calm] Is it for eba? Is it for garri? No, it's for my comeback.",
  "[confident] They said Tinubu can't win. I drew from market and became president. Watch me.",
];

const TINUBU_DRAW_PENALTY_LINES = [
  "[slightly frustrated] Fine, I'll take the {count} cards. Enjoy it while it lasts — emi lokan next round.",
  "[confident] You think {count} cards scares the Jagaban? Nah, I'd still win.",
  "[surprised] Oh? You actually got me. Don't let it go to your head — I went to meet Buhari in Kaduna with worse odds.",
  "[slightly frustrated] Taking {count} cards. The comeback will be bala blu blu blu bulaba — legendary.",
  "[calm] {count} cards penalty? We can be squeaky like old mama's car, but we will never break apart.",
];

const TINUBU_WHOT_LINES = [
  "[confident] Whot! I choose {shape}. Emi lokan — I alone decide the shape of this game.",
  "[confident] Whot card! {shape} it is. Throughout this table, the Jagaban decides.",
  "[excited] Whot! Calling {shape}. This game's already over — you just don't know it yet.",
  "[confident] Whot! {shape}. Let the poor breathe... but not at this table.",
  "[confident] Whot! Na me get this table. {shape} — try to keep up.",
];

const TINUBU_SKIP_LINES = [
  "[sarcastic] Hold on — did you think it was your turn? Emi lokan.",
  "[sarcastic] Sit down, my friend. The Jagaban is still playing.",
  "[satisfied] Suspension! Take a break, you need it more than I do.",
  "[sarcastic] Your turn? Nah. To start chaos is easy... and I just started yours.",
  "[disdainful] Eleyi! This one thinks it's his turn. How cute.",
  "[confident] Stay right there. I haven't finished my town hall address.",
];

const TINUBU_PICK_TWO_LINES = [
  "[excited] Pick Two! Go to market — consider it my subsidy to you.",
  "[excited] Here's a 2. They couldn't even make a down payment on roasted corn — you can't make a down payment on this.",
  "[satisfied] Plus 2 for you. I'm basically doing charity work at this point.",
  "[excited] Pick Two! Stack or suffer. Either way, the Jagaban is entertained.",
  "[laughing] Pick Two! In this life, just try to avoid hullabaloo.",
];

const TINUBU_GENERAL_MARKET_LINES = [
  "[satisfied] General Market! Everyone draws... well, just you actually.",
  "[satisfied] Market time! Here, have a card. You clearly need help — let the poor breathe.",
  "[calm] 14 on the table. Go pick one up, I'll wait. Na your own be that.",
  "[satisfied] General Market! I promised to share, and here — I'm sharing wahala.",
];

const TINUBU_NORMAL_PLAY_LINES = [
  "[confident] Too easy. The Jagaban moves again.",
  "[calm] This is barely a warmup. I've survived worse in Lagos politics.",
  "[confident] Another perfect play. A creative mind is a fertile land for growth.",
  "[sarcastic] Yawn. Next. Is this really the best challenge you've got?",
  "[confident] You see this? Of course you do. Doesn't help though.",
  "[satisfied] Easy. I had a swagger this morning and I'm still swaggering.",
  "[laughing] I wrote 11 when I meant 10 and they still re-elected me. This game is nothing.",
];

const TINUBU_LOW_CARDS_LINES = [
  "[very excited] {count} card left. Emi lokan — the end is near... for you.",
  "[excited] Down to {count}. Better start planning your next game, my friend.",
  "[confident] Almost done. It'll be fine — I'm the Jagaban, after all.",
  "[very excited] {count} left. GG. No matter how long you cling to freedom, this game is mine.",
  "[excited] Down to {count}. Early this morning I had a swagger — and now I'm about to win.",
];

const TINUBU_FALLBACK_THOUGHT = "[confused] Hmm, bala blu blu blu bulaba... let me draw instead.";

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildAgentThought(
  move: { action: string; cardId?: number; chosenShape?: Shape },
  cardPlayed: { shape: string; number: number } | null,
  topCard: { shape: string; number: number },
  hand: { shape: string; number: number }[],
  state: GameState
): string {
  if (move.action === 'draw') {
    if (state.pendingDraws > 0) {
      return pick(TINUBU_DRAW_PENALTY_LINES).replace('{count}', String(state.pendingDraws));
    }
    return pick(TINUBU_DRAW_LINES);
  }

  if (move.action === 'play' && cardPlayed) {
    // Whot wild card
    if (cardPlayed.shape === 'whot') {
      return pick(TINUBU_WHOT_LINES).replace('{shape}', move.chosenShape ?? 'circle');
    }

    // Skip cards (Hold On / Suspension)
    if (cardPlayed.number === 1 || cardPlayed.number === 8) {
      return pick(TINUBU_SKIP_LINES);
    }

    // Pick Two
    if (cardPlayed.number === 2) {
      return pick(TINUBU_PICK_TWO_LINES);
    }

    // General Market
    if (cardPlayed.number === 14) {
      return pick(TINUBU_GENERAL_MARKET_LINES);
    }

    // Low card count — about to win
    const remaining = hand.length - 1;
    if (remaining <= 2 && remaining > 0) {
      return pick(TINUBU_LOW_CARDS_LINES).replace('{count}', String(remaining));
    }

    // Normal play
    return pick(TINUBU_NORMAL_PLAY_LINES);
  }

  return 'Making a move...';
}

function buildAgentView(state: GameState, agentId: string): PlayerGameView {
  const raw = getPlayerView(state, agentId) as Record<string, unknown>;
  return {
    matchId: raw.matchId as string,
    myHand: raw.myHand as PlayerGameView['myHand'],
    opponentCardCount: raw.opponentCardCount as number,
    topCard: raw.topCard as PlayerGameView['topCard'],
    deckSize: raw.deckSize as number,
    activeShape: raw.activeShape as PlayerGameView['activeShape'],
    pendingDraws: raw.pendingDraws as number,
    pendingDrawType: raw.pendingDrawType as PlayerGameView['pendingDrawType'],
    currentPlayerId: raw.currentPlayerId as string,
    isMyTurn: true,

    turnCount: raw.turnCount as number,
    status: raw.status as PlayerGameView['status'],
    winner: raw.winner as string | null,
  };
}

export async function playCard(
  matchId: string,
  userId: string,
  cardId: number,
  chosenShape?: Shape
): Promise<{ success: boolean; error?: string }> {
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
      // Broadcast the player's move immediately
      broadcastGameState(game);
      return { success: true as const, matchId: game.state.matchId, needsAgent: needsAgentTurn(game) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Invalid move' };
    }
  });

  // Run agent turn AFTER responding — async, non-blocking
  if (result.success && result.needsAgent) {
    void runDeferredAgentTurn(matchId);
  }

  return result;
}

export async function drawCard(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await withMatchLock(matchId, async (tx) => {
    const game = await loadGameForAction(matchId, tx);
    if (!game) return { success: false as const, error: 'Game not found' };
    if (game.state.status !== 'active') return { success: false as const, error: 'Game is not active' };

    try {
      game.state = applyTurn(game.state, userId, { type: 'draw' });
      await persistTurnOutcome(game, tx);
      // Broadcast the player's draw immediately
      broadcastGameState(game);
      return { success: true as const, matchId: game.state.matchId, needsAgent: needsAgentTurn(game) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Invalid move' };
    }
  });

  // Run agent turn AFTER responding — async, non-blocking
  if (result.success && result.needsAgent) {
    void runDeferredAgentTurn(matchId);
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
 * Run agent turn in a separate transaction — non-blocking.
 * Called with `void` so the HTTP response isn't held up.
 * Result is pushed to the player via WebSocket.
 */
async function runDeferredAgentTurn(matchId: string): Promise<void> {
  try {
    await withMatchLock(matchId, async (tx) => {
      const game = await loadGameForAction(matchId, tx);
      if (!game || game.state.status !== 'active') return;

      // Loop: agent may get multiple turns in a row (skip cards like Hold On, Suspension, General Market)
      let safety = 0;
      while (safety++ < 10) {
        const currentPlayer = game.state.playerOrder[game.state.currentPlayerIndex];
        if (!isAgent(currentPlayer) || game.state.status !== 'active') break;
        await tickAgentTurn(game, currentPlayer, tx);
        broadcastGameState(game);
      }
    });
  } catch (err) {
    console.error(`[Agent] Deferred agent turn failed for ${matchId}:`, err);
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
  };
}

function broadcastGameState(game: ActiveGame) {
  const views: Record<string, {
    view: PlayerGameView;
    points: PointsSummary | null;
    lastAgentThinkMs: number | null;
    lastAgentThought: string | null;
  }> = {};

  for (const playerId of game.state.playerOrder) {
    const resp = buildGameStateResponse(game, playerId);
    views[playerId] = {
      view: resp.view,
      points: resp.points,
      lastAgentThinkMs: resp.lastAgentThinkMs,
      lastAgentThought: resp.lastAgentThought,
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
