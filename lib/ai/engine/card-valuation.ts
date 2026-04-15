/**
 * Layer 2 — Card Valuation Engine
 *
 * Assigns a dynamic score to every card in the AI's hand.
 * Lower score = more desirable to play now.
 * Also serves as the rollout policy for MCTS simulations.
 */

import type { Card, Shape } from '@/types/game';
import type { AIGameState, AIMove } from './types';
import { SHAPES } from './types';
import { getPlayableCards, isValidPlay } from '@/lib/game-engine/rules';

/**
 * Score every card in hand. Returns card ID → penalty score.
 * Lower = play first. Higher = keep.
 */
export function scoreCards(state: AIGameState): Map<number, number> {
  const scores = new Map<number, number>();
  const hand = state.hand;

  // Step 5 check: endgame inversion at ≤3 cards
  if (hand.length <= 3) {
    return scoreEndgameCards(state);
  }

  for (const card of hand) {
    let score = 0;

    // Step 1 — Base penalty: card number
    score += card.number;

    // Step 2 — Connectivity bonus
    let connectivity = 0;
    for (const other of hand) {
      if (other.id === card.id) continue;
      if (other.shape === card.shape && card.shape !== 'whot') connectivity++;
      if (other.number === card.number) connectivity++;
    }
    score -= connectivity * 1.5;

    // Step 3 — Whot suit concentration modifier
    if (card.shape === 'whot') {
      const maxSuitCount = getMaxSuitCount(hand);
      if (maxSuitCount >= 4) score -= 15;
      else if (maxSuitCount === 3) score -= 8;
      // else no modifier
    }

    // Step 4 — Special card context adjustment
    const oppClose = state.opponentHandSize <= 2;
    const oppComfortable = state.opponentHandSize >= 6;

    switch (card.number) {
      case 1: // Hold On
        if (oppClose) score -= 20;
        break;
      case 2: // Pick Two
        if (oppClose) score -= 20;
        else if (oppComfortable) score -= 8;
        break;
      case 14: // General Market
        if (state.deckSize < 5) score += 10; // dangerous with low deck
        break;
    }

    scores.set(card.id, score);
  }

  return scores;
}

/**
 * Step 5 — Endgame inversion at ≤3 cards.
 * Re-score purely by playability chains.
 */
function scoreEndgameCards(state: AIGameState): Map<number, number> {
  const scores = new Map<number, number>();
  const playable = getPlayableCards(
    state.hand,
    state.topCard,
    state.calledSuit,
    state.pendingDraws,
    state.pendingDrawType,
  );

  const playableIds = new Set(playable.map((c) => c.id));

  for (const card of state.hand) {
    if (!playableIds.has(card.id)) {
      // Can't play this card now — high penalty
      scores.set(card.id, 100);
      continue;
    }

    // Score by how many remaining cards would be playable after this play
    const remaining = state.hand.filter((c) => c.id !== card.id);
    let followUpCount = 0;

    for (const next of remaining) {
      // After playing `card`, the new top card is `card`
      const activeShape = card.shape === 'whot' ? getBestShape(state.hand, card) : null;
      if (isValidPlay(card, next, activeShape, 0, null)) {
        followUpCount++;
      }
    }

    // Lower score = better. More follow-ups = lower score.
    scores.set(card.id, -followUpCount * 10 + card.number);
  }

  return scores;
}

/**
 * Count the max number of cards sharing the same shape in hand.
 */
function getMaxSuitCount(hand: Card[]): number {
  const counts = new Map<string, number>();
  for (const card of hand) {
    if (card.shape === 'whot') continue;
    counts.set(card.shape, (counts.get(card.shape) ?? 0) + 1);
  }
  let max = 0;
  for (const count of counts.values()) {
    if (count > max) max = count;
  }
  return max;
}

/**
 * Pick the best shape to call when playing Whot.
 * Chooses the shape with the most cards in hand.
 */
export function getBestShape(hand: Card[], whotCard: Card): Shape {
  const counts: Record<Shape, number> = {
    circle: 0, triangle: 0, cross: 0, square: 0, star: 0,
  };

  for (const c of hand) {
    if (c.id === whotCard.id || c.shape === 'whot') continue;
    counts[c.shape as Shape]++;
  }

  let best: Shape = 'circle';
  let bestCount = -1;
  for (const shape of SHAPES) {
    if (counts[shape] > bestCount) {
      bestCount = counts[shape];
      best = shape;
    }
  }

  return best;
}

/**
 * Use card valuation as a rollout policy: pick the best legal move.
 * Used by MCTS simulations.
 */
export function valuationSelectMove(
  hand: Card[],
  topCard: Card,
  activeShape: Shape | null,
  pendingDraws: number,
  pendingDrawType: 2 | null,
  opponentHandSize: number,
  deckSize: number,
): AIMove {
  const playable = getPlayableCards(hand, topCard, activeShape, pendingDraws, pendingDrawType);

  if (playable.length === 0) {
    return { action: 'draw' };
  }

  // Build a minimal AIGameState for scoring
  const miniState: AIGameState = {
    hand,
    topCard,
    calledSuit: activeShape,
    opponentHandSize,
    deckSize,
    playedCards: [],
    unseenCards: [],
    turnHistory: [],
    pendingDraws,
    pendingDrawType,
    turnCount: 0,
    opponentId: '',
    agentId: '',
  };

  const scores = scoreCards(miniState);

  // Pick the card with the lowest score (most desirable)
  let bestCard: Card | null = null;
  let bestScore = Infinity;

  for (const card of playable) {
    const score = scores.get(card.id) ?? card.number;
    if (score < bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  if (!bestCard) {
    return { action: 'draw' };
  }

  const move: AIMove = { action: 'play', cardId: bestCard.id };
  if (bestCard.shape === 'whot') {
    move.chosenShape = getBestShape(hand, bestCard);
  }

  return move;
}
