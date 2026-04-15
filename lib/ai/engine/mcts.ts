/**
 * Layer 3 — MCTS with Determinization
 *
 * Monte Carlo Tree Search over determinized game states.
 * Samples 20 possible opponent hands, runs 400 MCTS iterations each,
 * then votes across samples for the best move.
 */

import type { Card, Shape } from '@/types/game';
import type { AIGameState, AIMove, OpponentModel, SimState } from './types';
import { getBestShape } from './card-valuation';
import { applyDoctrine } from './doctrine';
import { applyRiggedDoctrine, type RiggedContext } from './rigged-tactics';
import { getPlayableCards } from '@/lib/game-engine/rules';

const NUM_SAMPLES = 20;
const ITERATIONS_PER_SAMPLE = 400;
const MAX_DEPTH = 10;
const UCB1_C = 1.4;
const MAX_ROLLOUT_TURNS = 30;

interface MCTSNode {
  move: AIMove | null;       // null for root
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: AIMove[];
}

/**
 * Select the best move using MCTS with determinization.
 */
export function mctsSelectMove(
  state: AIGameState,
  legalMoves: AIMove[],
  model: OpponentModel,
  timeBudgetMs: number = 1500,
  riggedCtx?: RiggedContext | null,
  opponentHand?: Card[],
): AIMove {
  if (legalMoves.length <= 1) {
    return legalMoves[0] ?? { action: 'draw' };
  }

  // Apply doctrine modifiers (base + rigged overlay) for tiebreaking
  const doctrineScores = new Map<string, number>();
  for (const move of legalMoves) {
    const card = move.cardId !== undefined
      ? state.hand.find((c) => c.id === move.cardId)
      : undefined;
    let modifier = card ? applyDoctrine(card, state, model, move.chosenShape) : 0;
    // Rigged mode: layer score-aware aggression on top
    if (riggedCtx && opponentHand && card) {
      modifier += applyRiggedDoctrine(card, state, riggedCtx, opponentHand);
    }
    doctrineScores.set(moveKey(move), modifier);
  }

  // Vote tallies: moveKey → { votes, totalWinRate }
  const votes = new Map<string, { votes: number; totalWinRate: number }>();
  for (const move of legalMoves) {
    votes.set(moveKey(move), { votes: 0, totalWinRate: 0 });
  }

  const deadline = Date.now() + timeBudgetMs;
  const samplesRun = Math.min(NUM_SAMPLES, Math.max(5, Math.floor(timeBudgetMs / 75)));
  const itersPerSample = Math.min(ITERATIONS_PER_SAMPLE, Math.max(50, Math.floor(timeBudgetMs / samplesRun / 0.5)));

  for (let s = 0; s < samplesRun; s++) {
    if (Date.now() >= deadline) break;

    // Determinize: sample a plausible opponent hand
    const opponentHand = sampleOpponentHand(state, model);
    const simState = createSimState(state, opponentHand);

    // Run MCTS on this determinized state
    const bestMove = runMCTS(simState, legalMoves, itersPerSample, deadline);
    if (!bestMove) continue;

    const key = moveKey(bestMove.move);
    const entry = votes.get(key);
    if (entry) {
      entry.votes++;
      entry.totalWinRate += bestMove.winRate;
    }
  }

  // Pick move with most votes, tiebreak by win rate + doctrine
  let bestKey = moveKey(legalMoves[0]);
  let bestVotes = -1;
  let bestScore = -Infinity;

  for (const [key, data] of votes) {
    const avgWinRate = data.votes > 0 ? data.totalWinRate / data.votes : 0;
    const doctrine = doctrineScores.get(key) ?? 0;
    // Doctrine is a penalty (lower = better), so negate it for score
    const score = avgWinRate * 100 - doctrine;

    if (data.votes > bestVotes || (data.votes === bestVotes && score > bestScore)) {
      bestVotes = data.votes;
      bestScore = score;
      bestKey = key;
    }
  }

  return legalMoves.find((m) => moveKey(m) === bestKey) ?? legalMoves[0];
}

/**
 * Run MCTS iterations on a single determinized state.
 */
function runMCTS(
  rootState: SimState,
  legalMoves: AIMove[],
  iterations: number,
  deadline: number,
): { move: AIMove; winRate: number } | null {
  const root: MCTSNode = {
    move: null,
    parent: null,
    children: [],
    visits: 0,
    wins: 0,
    untriedMoves: [...legalMoves],
  };

  for (let i = 0; i < iterations; i++) {
    if (i % 50 === 0 && Date.now() >= deadline) break;

    let node = root;
    const sim = cloneSimState(rootState);

    // Selection — traverse tree using UCB1
    let depth = 0;
    while (node.untriedMoves.length === 0 && node.children.length > 0 && depth < MAX_DEPTH) {
      node = selectChild(node);
      applySimMove(sim, node.move!);
      depth++;
    }

    // Expansion — add a new child
    if (node.untriedMoves.length > 0 && sim.winner === null && depth < MAX_DEPTH) {
      const moveIdx = Math.floor(Math.random() * node.untriedMoves.length);
      const move = node.untriedMoves.splice(moveIdx, 1)[0];
      applySimMove(sim, move);

      const child: MCTSNode = {
        move,
        parent: node,
        children: [],
        visits: 0,
        wins: 0,
        untriedMoves: getSimLegalMoves(sim),
      };
      node.children.push(child);
      node = child;
    }

    // Simulation (rollout) — play to completion using card valuation
    const result = rollout(sim);

    // Backpropagation
    let backNode: MCTSNode | null = node;
    while (backNode !== null) {
      backNode.visits++;
      if (result === 0) backNode.wins++; // AI is player 0
      backNode = backNode.parent;
    }
  }

  // Pick best child by visit count
  if (root.children.length === 0) return null;

  let best = root.children[0];
  for (const child of root.children) {
    if (child.visits > best.visits) {
      best = child;
    }
  }

  return {
    move: best.move!,
    winRate: best.visits > 0 ? best.wins / best.visits : 0,
  };
}

/**
 * UCB1 selection: pick child with highest exploration-exploitation score.
 */
function selectChild(node: MCTSNode): MCTSNode {
  let best = node.children[0];
  let bestUCB = -Infinity;
  const logParent = Math.log(node.visits);

  for (const child of node.children) {
    const exploitation = child.visits > 0 ? child.wins / child.visits : 0.5;
    const exploration = Math.sqrt(logParent / (child.visits || 1));
    const ucb = exploitation + UCB1_C * exploration;

    if (ucb > bestUCB) {
      bestUCB = ucb;
      best = child;
    }
  }

  return best;
}

/**
 * Rollout: simulate game to completion using card valuation heuristic.
 * Returns the winning player index (0 = AI, 1 = opponent).
 */
function rollout(sim: SimState): 0 | 1 {
  let turns = 0;
  while (sim.winner === null && turns < MAX_ROLLOUT_TURNS) {
    const hand = sim.hands[sim.currentPlayer];
    if (hand.length === 0) {
      sim.winner = sim.currentPlayer;
      break;
    }

    const otherPlayer = sim.currentPlayer === 0 ? 1 : 0;
    const move = rolloutPickMove(hand, sim.topCard, sim.activeShape, sim.pendingDraws, sim.pendingDrawType, sim.hands[otherPlayer].length);
    applySimMove(sim, move);
    turns++;
  }

  if (sim.winner !== null) return sim.winner;

  // Timeout: player with fewer cards wins
  return sim.hands[0].length <= sim.hands[1].length ? 0 : 1;
}

// ── Simulation State Management ──

function createSimState(state: AIGameState, opponentHand: Card[]): SimState {
  // Build deck: unseen cards minus opponent hand
  const opponentIds = new Set(opponentHand.map((c) => c.id));
  const deck = state.unseenCards.filter((c) => !opponentIds.has(c.id));

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Seed discard pile from real game history (excluding the current top card)
  const discardPile = state.playedCards.filter((c) => c.id !== state.topCard.id);

  return {
    hands: [state.hand.slice(), opponentHand.slice()],
    deck,
    discardPile,
    topCard: state.topCard,
    activeShape: state.calledSuit,
    pendingDraws: state.pendingDraws,
    pendingDrawType: state.pendingDrawType,
    currentPlayer: 0, // AI always starts (it's their turn)
    turnCount: 0,
    winner: null,
  };
}

function cloneSimState(sim: SimState): SimState {
  // Shallow-copy arrays only — card objects are never mutated, only moved between arrays
  return {
    hands: [sim.hands[0].slice(), sim.hands[1].slice()],
    deck: sim.deck.slice(),
    discardPile: sim.discardPile.slice(),
    topCard: sim.topCard,
    activeShape: sim.activeShape,
    pendingDraws: sim.pendingDraws,
    pendingDrawType: sim.pendingDrawType,
    currentPlayer: sim.currentPlayer,
    turnCount: sim.turnCount,
    winner: sim.winner,
  };
}

function applySimMove(sim: SimState, move: AIMove): void {
  const hand = sim.hands[sim.currentPlayer];
  const otherPlayer: 0 | 1 = sim.currentPlayer === 0 ? 1 : 0;

  if (move.action === 'draw') {
    if (sim.pendingDraws > 0) {
      // Resolve pending draws
      const toDraw = sim.pendingDraws;
      for (let i = 0; i < toDraw; i++) {
        const card = drawFromDeck(sim);
        if (card) hand.push(card);
      }
      sim.pendingDraws = 0;
      sim.pendingDrawType = null;
    } else {
      const card = drawFromDeck(sim);
      if (card) hand.push(card);
    }
    sim.currentPlayer = otherPlayer;
    sim.turnCount++;
    return;
  }

  // Play a card
  const cardIdx = hand.findIndex((c) => c.id === move.cardId);
  if (cardIdx === -1) {
    // Invalid move in simulation — fall back to draw
    const card = drawFromDeck(sim);
    if (card) hand.push(card);
    sim.currentPlayer = otherPlayer;
    sim.turnCount++;
    return;
  }

  const card = hand.splice(cardIdx, 1)[0];
  sim.discardPile.push(sim.topCard);
  sim.topCard = card;
  sim.activeShape = null;

  // Check win
  if (hand.length === 0) {
    sim.winner = sim.currentPlayer;
    return;
  }

  // Apply card effects
  let skipOpponent = false;

  switch (card.number) {
    case 1: // Hold On — skip opponent, current player goes again
      skipOpponent = true;
      break;
    case 2: // Pick Two — stack
      sim.pendingDraws += 2;
      sim.pendingDrawType = 2;
      break;
    case 14: // General Market — opponent draws 1, current player goes again
      const drawn = drawFromDeck(sim);
      if (drawn) sim.hands[otherPlayer].push(drawn);
      skipOpponent = true;
      break;
    case 20: // Whot — set active shape
      sim.activeShape = move.chosenShape ?? 'circle';
      break;
  }

  if (!skipOpponent) {
    sim.currentPlayer = otherPlayer;
  }
  sim.turnCount++;
}

function drawFromDeck(sim: SimState): Card | null {
  if (sim.deck.length === 0) {
    // Recycle discard pile
    if (sim.discardPile.length === 0) return null;
    sim.deck = sim.discardPile;
    sim.discardPile = [];
    // Shuffle recycled deck
    for (let i = sim.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sim.deck[i], sim.deck[j]] = [sim.deck[j], sim.deck[i]];
    }
  }
  return sim.deck.pop() ?? null;
}

function getSimLegalMoves(sim: SimState): AIMove[] {
  const hand = sim.hands[sim.currentPlayer];
  const playable = getPlayableCards(
    hand,
    sim.topCard,
    sim.activeShape,
    sim.pendingDraws,
    sim.pendingDrawType,
  );

  const moves: AIMove[] = [];
  for (const card of playable) {
    if (card.shape === 'whot') {
      // Pick the shape with most cards in hand
      const shape = getBestShape(hand, card);
      moves.push({ action: 'play', cardId: card.id, chosenShape: shape });
    } else {
      moves.push({ action: 'play', cardId: card.id });
    }
  }

  // Always add draw as an option
  moves.push({ action: 'draw' });
  return moves;
}

/**
 * Sample a plausible opponent hand by distributing unseen cards
 * weighted by card probabilities from the opponent model.
 */
function sampleOpponentHand(state: AIGameState, model: OpponentModel): Card[] {
  const unseen = [...state.unseenCards];
  const targetSize = state.opponentHandSize;

  if (unseen.length <= targetSize) {
    return unseen;
  }

  // Weighted sampling without replacement
  const weights: number[] = unseen.map((card) => {
    const key = `${card.shape}-${card.number}`;
    return model.cardProbabilities.get(key) ?? 0.5;
  });

  const hand: Card[] = [];
  const remaining = [...unseen];
  const remainingWeights = [...weights];

  for (let i = 0; i < targetSize && remaining.length > 0; i++) {
    const totalWeight = remainingWeights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) {
      // Uniform fallback
      const idx = Math.floor(Math.random() * remaining.length);
      hand.push(remaining.splice(idx, 1)[0]);
      remainingWeights.splice(idx, 1);
      continue;
    }

    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < remainingWeights.length - 1; idx++) {
      r -= remainingWeights[idx];
      if (r <= 0) break;
    }

    hand.push(remaining.splice(idx, 1)[0]);
    remainingWeights.splice(idx, 1);
  }

  return hand;
}

/**
 * Allocation-free rollout move selector.
 * Inline scoring without Map/object creation — called ~240K times during MCTS.
 */
function rolloutPickMove(
  hand: Card[],
  topCard: Card,
  activeShape: Shape | null,
  pendingDraws: number,
  pendingDrawType: 2 | null,
  oppHandSize: number,
): AIMove {
  const playable = getPlayableCards(hand, topCard, activeShape, pendingDraws, pendingDrawType);
  if (playable.length === 0) return { action: 'draw' };

  // Score inline — no Map, no intermediate objects
  let bestCard: Card | null = null;
  let bestScore = Infinity; // lower = play first

  const oppClose = oppHandSize <= 2;

  for (const card of playable) {
    let score = card.number; // base penalty

    // Connectivity: count same-shape and same-number cards in hand
    let connectivity = 0;
    for (const other of hand) {
      if (other.id === card.id) continue;
      if (other.shape === card.shape && card.shape !== 'whot') connectivity++;
      if (other.number === card.number) connectivity++;
    }
    score -= connectivity * 1.5;

    // Special card context
    if (card.number === 1 && oppClose) score -= 20;
    if (card.number === 2 && oppClose) score -= 20;
    if (card.number === 20) score += 10; // conserve Whot
    if (card.number === 20 && hand.length <= 3) score -= 25;

    if (score < bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  if (!bestCard) return { action: 'draw' };

  const move: AIMove = { action: 'play', cardId: bestCard.id };
  if (bestCard.shape === 'whot') {
    move.chosenShape = getBestShape(hand, bestCard);
  }
  return move;
}

function moveKey(move: AIMove): string {
  if (move.action === 'draw') return 'draw';
  return `play-${move.cardId}-${move.chosenShape ?? ''}`;
}
