import type { Shape, Card } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';
import { getPlayableCards } from '@/lib/game-engine/rules';

interface AIMove {
  action: 'play' | 'draw';
  cardId?: number;
  chosenShape?: Shape;
}

const SHAPES: Shape[] = ['circle', 'triangle', 'cross', 'square', 'star'];

/**
 * Tinubu's brain — a scoring-based strategy engine.
 * Evaluates every legal move and picks the highest-scoring one.
 * Instant, deterministic, and ruthlessly effective.
 */
export async function getAIMove(state: PlayerGameView): Promise<AIMove> {
  const playable = getPlayableCards(
    state.myHand,
    state.topCard,
    state.activeShape,
    state.pendingDraws,
    state.pendingDrawType
  );

  // Must draw — no cards to play
  if (playable.length === 0) {
    return { action: 'draw' };
  }

  // Forced draw scenario — can only stack or draw
  if (state.pendingDraws > 0) {
    const stackable = playable.filter(c => c.number === state.pendingDrawType);
    if (stackable.length === 0) {
      return { action: 'draw' };
    }
    // Stack a Pick Two — always stack when possible
    return { action: 'play', cardId: stackable[0].id };
  }

  // Score every possible move and pick the best
  const candidates: { move: AIMove; score: number }[] = [];

  for (const card of playable) {
    if (card.shape === 'whot') {
      // Evaluate each shape choice for Whot
      const bestShape = pickBestShape(state.myHand, card);
      const score = scoreMove(card, bestShape, state);
      candidates.push({
        move: { action: 'play', cardId: card.id, chosenShape: bestShape },
        score,
      });
    } else {
      const score = scoreMove(card, undefined, state);
      candidates.push({
        move: { action: 'play', cardId: card.id },
        score,
      });
    }
  }

  // Sort by score descending, with a small random tiebreaker for variety
  candidates.sort((a, b) => {
    const diff = b.score - a.score;
    if (Math.abs(diff) < 0.5) return Math.random() - 0.5;
    return diff;
  });

  const best = candidates[0];

  // Should we draw instead? Only if all plays are terrible
  if (best.score < -20 && state.myHand.length < 8) {
    return { action: 'draw' };
  }

  return best.move;
}

/**
 * Score a card play. Higher = better.
 *
 * Scoring factors:
 *  1. Offensive power — punish the opponent
 *  2. Shape control — play shapes you have many of
 *  3. Card value — get rid of high-value cards early
 *  4. Wild conservation — save Whots for when you need them
 *  5. Endgame awareness — opponent card count matters
 *  6. Tempo — skip cards are more valuable when opponent is close to winning
 */
function scoreMove(
  card: Card,
  chosenShape: Shape | undefined,
  state: PlayerGameView
): number {
  let score = 0;
  const hand = state.myHand;
  const oppCards = state.opponentCardCount;
  const myCards = hand.length;
  const oppDanger = oppCards <= 3; // opponent is close to winning

  // ── 1. Offensive power ──
  switch (card.number) {
    case 2: // Pick Two — force opponent to draw
      score += 25;
      if (oppDanger) score += 20; // devastating when they're close to winning
      break;
    case 1: // Hold On — skip + play again
      score += 15;
      if (oppDanger) score += 15;
      break;
    case 8: // Suspension — skip + play again
      score += 15;
      if (oppDanger) score += 15;
      break;
    case 14: // General Market — opponent draws 1 + play again
      score += 18;
      if (oppDanger) score += 12;
      break;
    case 20: // Whot — wild card
      // Penalize playing wilds early — they're more valuable later
      score -= 10;
      if (myCards <= 3) score += 25; // but play them in endgame
      if (oppDanger && myCards > 4) score -= 15; // save for defense
      break;
  }

  // ── 2. Shape control — prefer shapes you have many of ──
  if (card.shape !== 'whot') {
    const sameShapeCount = hand.filter(c => c.shape === card.shape && c.id !== card.id).length;
    // Playing a card whose shape matches others in hand = good sequencing
    score += sameShapeCount * 4;

    // If this is the LAST card of a shape, slight penalty (less flexibility after)
    if (sameShapeCount === 0) score -= 3;
  }

  // For Whot cards, bonus for choosing a shape we have many of
  if (card.number === 20 && chosenShape) {
    const shapeCount = hand.filter(c => c.shape === chosenShape).length;
    score += shapeCount * 6;
  }

  // ── 3. Card value — prefer getting rid of high-number cards ──
  // High-value cards in hand = bigger penalty if we lose
  if (card.number !== 20) {
    score += Math.min(card.number, 14) * 0.5;
  }

  // ── 4. Number matching potential ──
  // Cards with common numbers are more flexible — less urgency to play
  const sameNumberCount = hand.filter(c => c.number === card.number && c.id !== card.id).length;
  if (sameNumberCount > 0 && card.number !== 20) {
    score -= 2; // we have backup plays with this number, less urgent
  }

  // ── 5. Endgame awareness ──
  if (myCards === 2) {
    // About to go down to 1 card — play the less useful card
    const otherCard = hand.find(c => c.id !== card.id);
    if (otherCard) {
      // Keep the more powerful/flexible card
      if (otherCard.number === 20) score += 8; // keep the Whot
      if ([1, 2, 8, 14].includes(otherCard.number)) score += 4; // keep special cards
    }
  }

  if (myCards === 1) {
    // This is our last card — instant win!
    score += 100;
  }

  // ── 6. Tempo when opponent is dangerous ──
  if (oppDanger) {
    // Prioritize anything that disrupts them
    if ([1, 2, 8, 14].includes(card.number)) {
      score += 10;
    }
    // Non-special cards are less valuable when opponent is about to win
    if (![1, 2, 8, 14, 20].includes(card.number)) {
      score -= 5;
    }
  }

  return score;
}

/**
 * Pick the best shape to call when playing a Whot card.
 * Chooses the shape we have the most of (excluding the Whot being played).
 */
function pickBestShape(hand: Card[], whotCard: Card): Shape {
  const counts: Record<Shape, number> = {
    circle: 0, triangle: 0, cross: 0, square: 0, star: 0,
  };

  for (const c of hand) {
    if (c.id === whotCard.id || c.shape === 'whot') continue;
    counts[c.shape as Shape]++;
  }

  let bestShape: Shape = 'circle';
  let bestCount = -1;
  for (const shape of SHAPES) {
    if (counts[shape] > bestCount) {
      bestCount = counts[shape];
      bestShape = shape;
    }
  }

  return bestShape;
}
