/**
 * Tinubu's brain — 6-layer AI strategy engine.
 *
 * Layer 1: Game state representation with Bayesian card probabilities
 * Layer 2: Dynamic card valuation (connectivity, suit concentration, context)
 * Layer 3: MCTS with determinization (20 samples × 400 iterations)
 * Layer 4: Opponent modeling (hand tracking, suit preferences, pick inference)
 * Layer 5: Special card doctrine (override rules for 1, 2, 14, 20)
 * Layer 6: Endgame precision (exhaustive search at ≤4 cards)
 */

import type { Card, Shape, AgentGameView } from '@/types/game';
import type { AIMove, OpponentModel } from './engine/types';
import { SHAPES } from './engine/types';
import { buildAIState } from './engine/state-tracker';
import { buildOpponentModel, buildPerfectOpponentModel } from './engine/opponent-model';
import { getBestShape } from './engine/card-valuation';
import { mctsSelectMove } from './engine/mcts';
import { endgameSelectMove } from './engine/endgame';
import { getPlayableCards } from '@/lib/game-engine/rules';

export type { AIMove };

/**
 * Main entry point: select the best move given the current game state.
 * Dispatches to MCTS (mid-game) or exhaustive search (endgame).
 */
export async function getAIMove(view: AgentGameView): Promise<AIMove> {
  const aiState = buildAIState(view);

  // Rigged mode: inject perfect knowledge of opponent's hand
  if (view.difficulty === 'rigged' && view.opponentHand) {
    // Override the Bayesian model with certainty — we know exactly what they have
    const perfectProbs = new Map<string, number>();
    for (const card of view.opponentHand) {
      const key = `${card.shape}-${card.number}`;
      perfectProbs.set(key, (perfectProbs.get(key) ?? 0) + 1);
    }
    // Set unseen cards to exactly what we don't know (deck only)
    aiState.unseenCards = aiState.unseenCards.filter(
      (c) => !view.opponentHand!.some((oh) => oh.id === c.id)
    );
  }

  const opponentModel = view.difficulty === 'rigged' && view.opponentHand
    ? buildPerfectOpponentModel(view.opponentHand, view.opponentCardCount)
    : buildOpponentModel(
        view.turnLog,
        view.discardPile,
        view.myHand,
        view.opponentId,
        view.opponentCardCount,
      );

  // Get all legal moves
  const playable = getPlayableCards(
    aiState.hand,
    aiState.topCard,
    aiState.calledSuit,
    aiState.pendingDraws,
    aiState.pendingDrawType,
  );

  // Must draw — no playable cards
  if (playable.length === 0) {
    return { action: 'draw' };
  }

  // Forced draw: pending draws with no stackable cards
  if (aiState.pendingDraws > 0) {
    const stackable = playable.filter((c) => c.number === aiState.pendingDrawType);
    if (stackable.length === 0) {
      return { action: 'draw' };
    }
    // Can stack — these are the only legal plays
    if (stackable.length === 1) {
      return { action: 'play', cardId: stackable[0].id };
    }
  }

  // Build legal move list
  const legalMoves: AIMove[] = [];
  for (const card of playable) {
    if (card.shape === 'whot') {
      // Rigged mode: pick the shape opponent has ZERO of (if we can see their hand)
      const bestShape = (view.difficulty === 'rigged' && view.opponentHand)
        ? pickDeadlyShape(aiState.hand, card, view.opponentHand)
        : pickSmartShape(aiState.hand, card, opponentModel);
      legalMoves.push({ action: 'play', cardId: card.id, chosenShape: bestShape });
    } else {
      legalMoves.push({ action: 'play', cardId: card.id });
    }
  }

  // Single legal play — just do it
  if (legalMoves.length === 1) {
    return legalMoves[0];
  }

  // Layer 6: endgame exhaustive search — rigged gets deeper search (≤6 cards)
  const endgameThreshold = view.difficulty === 'rigged' ? 6 : 4;
  if (aiState.hand.length <= endgameThreshold) {
    return endgameSelectMove(aiState, legalMoves, opponentModel);
  }

  // Layer 3: MCTS — rigged gets more time since perfect info makes each iteration more valuable
  const mctsTime = view.difficulty === 'rigged' ? 2500 : 1500;
  return mctsSelectMove(aiState, legalMoves, opponentModel, mctsTime);
}

/**
 * Pick the best shape when playing Whot, considering opponent weakness.
 * Prefers the shape we hold the most of, weighted against opponent's weakest.
 */
function pickSmartShape(hand: Card[], whotCard: Card, model: OpponentModel): Shape {
  const counts: Record<Shape, number> = {
    circle: 0, triangle: 0, cross: 0, square: 0, star: 0,
  };

  for (const c of hand) {
    if (c.id === whotCard.id || c.shape === 'whot') continue;
    counts[c.shape as Shape]++;
  }

  let bestShape: Shape = 'circle';
  let bestScore = -Infinity;

  for (const shape of SHAPES) {
    let score = counts[shape] * 3;

    // Penalise calling opponent's dominant suit
    if (model.dominantSuit === shape) {
      score -= 5;
    }

    // Bonus for calling a suit opponent is weak in
    let oppStrength = 0;
    for (const [key, prob] of model.cardProbabilities) {
      if (key.startsWith(shape + '-')) oppStrength += prob;
    }
    score -= oppStrength * 2;

    if (score > bestScore) {
      bestScore = score;
      bestShape = shape;
    }
  }

  return bestShape;
}

/**
 * Rigged mode: pick the shape that causes maximum damage.
 * Finds a shape the opponent has ZERO cards of AND that we have many of.
 */
function pickDeadlyShape(hand: Card[], whotCard: Card, opponentHand: Card[]): Shape {
  // Count opponent's cards per shape
  const oppCounts: Record<Shape, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of opponentHand) {
    if (c.shape !== 'whot') oppCounts[c.shape as Shape]++;
  }

  // Count our cards per shape
  const myCounts: Record<Shape, number> = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0 };
  for (const c of hand) {
    if (c.id === whotCard.id || c.shape === 'whot') continue;
    myCounts[c.shape as Shape]++;
  }

  let bestShape: Shape = 'circle';
  let bestScore = -Infinity;

  for (const shape of SHAPES) {
    // Massive bonus for shapes opponent has ZERO of — forces them to draw
    let score = oppCounts[shape] === 0 ? 100 : -oppCounts[shape] * 10;
    // Also prefer shapes we have many of for follow-up plays
    score += myCounts[shape] * 3;

    if (score > bestScore) {
      bestScore = score;
      bestShape = shape;
    }
  }

  return bestShape;
}
