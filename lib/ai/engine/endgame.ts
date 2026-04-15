/**
 * Layer 6 — Endgame Precision
 *
 * When the AI has ≤4 cards, switch from MCTS to exhaustive search.
 * Enumerates all play sequences to find guaranteed wins or
 * the sequence that maximises win path optionality.
 */

import type { Card, Shape } from '@/types/game';
import type { AIGameState, AIMove, OpponentModel, SimState } from './types';
import { SHAPES } from './types';
import { getPlayableCards } from '@/lib/game-engine/rules';
import { getBestShape } from './card-valuation';

interface SearchResult {
  move: AIMove;
  turnsToWin: number;     // Infinity if no guaranteed win
  winPaths: number;       // number of win paths from this move
  isGuaranteed: boolean;  // can we guarantee a win?
}

/**
 * Exhaustive endgame search at ≤4 cards.
 * Returns the optimal first move.
 */
export function endgameSelectMove(
  state: AIGameState,
  legalMoves: AIMove[],
  model: OpponentModel,
): AIMove {
  if (legalMoves.length <= 1) {
    return legalMoves[0] ?? { action: 'draw' };
  }

  const results: SearchResult[] = [];

  for (const move of legalMoves) {
    if (move.action === 'draw') {
      // Drawing doesn't lead to winning this turn
      results.push({ move, turnsToWin: Infinity, winPaths: 0, isGuaranteed: false });
      continue;
    }

    const card = state.hand.find((c) => c.id === move.cardId);
    if (!card) continue;

    // Simulate playing this card
    const remainingHand = state.hand.filter((c) => c.id !== card.id);

    // Immediate win
    if (remainingHand.length === 0) {
      return move; // instant win — play it
    }

    // Check win path from remaining cards
    const activeShape = card.shape === 'whot' ? (move.chosenShape ?? getBestShape(state.hand, card)) : null;
    const newTopCard = card;

    const winPaths = countWinPaths(remainingHand, newTopCard, activeShape, 0);
    const bestPath = findBestPath(remainingHand, newTopCard, activeShape, 0);

    results.push({
      move,
      turnsToWin: bestPath ?? Infinity,
      winPaths,
      isGuaranteed: bestPath !== null && bestPath <= remainingHand.length,
    });
  }

  // Priority 1: guaranteed win in fewest turns
  const guaranteed = results.filter((r) => r.isGuaranteed);
  if (guaranteed.length > 0) {
    guaranteed.sort((a, b) => a.turnsToWin - b.turnsToWin);
    return guaranteed[0].move;
  }

  // Priority 2: most win paths (optionality)
  results.sort((a, b) => {
    if (b.winPaths !== a.winPaths) return b.winPaths - a.winPaths;
    return a.turnsToWin - b.turnsToWin;
  });

  // If no play option has win paths, check if drawing might help
  if (results[0].winPaths === 0) {
    // Verify the last card would be playable
    const bestPlay = results.find((r) => r.move.action === 'play');
    if (bestPlay) {
      const card = state.hand.find((c) => c.id === bestPlay.move.cardId);
      if (card) {
        const remaining = state.hand.filter((c) => c.id !== card.id);
        if (remaining.length === 1) {
          // Final card legality check: would the last card be playable?
          const lastCard = remaining[0];
          const activeShape = card.shape === 'whot' ? (bestPlay.move.chosenShape ?? null) : null;
          if (!wouldBePlayable(lastCard, card, activeShape)) {
            // This sequence would leave us stuck — try a different order
            const alternative = findAlternativeOrder(state, legalMoves);
            if (alternative) return alternative;
          }
        }
      }
    }
  }

  return results[0].move;
}

/**
 * Count how many win paths exist from a given hand state.
 * A win path is a sequence of plays that empties the hand.
 */
function countWinPaths(
  hand: Card[],
  topCard: Card,
  activeShape: Shape | null,
  depth: number,
): number {
  if (hand.length === 0) return 1;
  if (depth > 5) return 0; // prevent explosion

  const playable = getPlayableCards(hand, topCard, activeShape, 0, null);
  if (playable.length === 0) return 0;

  let paths = 0;
  for (const card of playable) {
    const remaining = hand.filter((c) => c.id !== card.id);
    const newActiveShape = card.shape === 'whot' ? getBestShape(hand, card) : null;
    // Skip cards (1, 14) let us play again
    const isSkip = card.number === 1 || card.number === 14;

    if (isSkip) {
      // We get to play again — continue searching
      paths += countWinPaths(remaining, card, newActiveShape, depth + 1);
    } else {
      // Opponent plays next — we can't guarantee what happens
      // But count it as a potential path if remaining is small
      if (remaining.length === 0) {
        paths += 1;
      } else {
        // Check if any remaining card could follow on next turn
        for (const next of remaining) {
          if (wouldBePlayable(next, card, newActiveShape)) {
            paths += 1;
            break;
          }
        }
      }
    }
  }

  return paths;
}

/**
 * Find the shortest guaranteed win path (number of turns).
 * Returns null if no guaranteed path exists.
 */
function findBestPath(
  hand: Card[],
  topCard: Card,
  activeShape: Shape | null,
  depth: number,
): number | null {
  if (hand.length === 0) return 0;
  if (depth > 5) return null;

  const playable = getPlayableCards(hand, topCard, activeShape, 0, null);
  if (playable.length === 0) return null;

  let bestTurns: number | null = null;

  for (const card of playable) {
    const remaining = hand.filter((c) => c.id !== card.id);
    const newActiveShape = card.shape === 'whot' ? getBestShape(hand, card) : null;
    const isSkip = card.number === 1 || card.number === 14;

    if (remaining.length === 0) {
      // This play wins!
      return 1;
    }

    if (isSkip) {
      // We play again immediately — continue search
      const subPath = findBestPath(remaining, card, newActiveShape, depth + 1);
      if (subPath !== null) {
        const total = 1 + subPath;
        if (bestTurns === null || total < bestTurns) {
          bestTurns = total;
        }
      }
    }
    // Non-skip: opponent intervenes, can't guarantee
  }

  return bestTurns;
}

/**
 * Check if a card would be playable given a hypothetical top card.
 */
function wouldBePlayable(card: Card, topCard: Card, activeShape: Shape | null): boolean {
  if (card.shape === 'whot') return true;
  if (activeShape) return card.shape === activeShape;
  if (topCard.shape === 'whot') return true;
  return card.shape === topCard.shape || card.number === topCard.number;
}

/**
 * Try to find an alternative play order where the final card is playable.
 */
function findAlternativeOrder(state: AIGameState, legalMoves: AIMove[]): AIMove | null {
  for (const move of legalMoves) {
    if (move.action !== 'play') continue;

    const card = state.hand.find((c) => c.id === move.cardId);
    if (!card) continue;

    const remaining = state.hand.filter((c) => c.id !== card.id);
    if (remaining.length !== 1) continue;

    const lastCard = remaining[0];
    const activeShape = card.shape === 'whot' ? (move.chosenShape ?? null) : null;

    if (wouldBePlayable(lastCard, card, activeShape)) {
      return move;
    }
  }
  return null;
}
