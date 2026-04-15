/**
 * Layer 4 — Opponent Modeling
 *
 * Reconstructs opponent behavior from the full game history.
 * Tracks hand size, suit preferences, and infers card probabilities
 * using Bayesian reasoning from pick events.
 */

import type { Card, Shape, GameLogEntry } from '@/types/game';
import type { OpponentModel, CardKey } from './types';
import { cardKey, FULL_DECK, SHAPES } from './types';

/**
 * Build a complete opponent model from game history.
 * Called fresh each turn — stateless reconstruction from logs.
 */
export function buildOpponentModel(
  turnLog: GameLogEntry[],
  discardPile: Card[],
  myHand: Card[],
  opponentId: string,
  opponentHandSize: number,
): OpponentModel {
  const suitCallHistory: Shape[] = [];
  const pickTopCards: Card[] = [];

  // Walk through the log to extract opponent behavior.
  // discardPile[0] is the starter card (not a played card).
  // discardPile[1] is the first card actually played, etc.
  // topCardIndex tracks which discard pile entry is the current top card.
  let topCardIndex = 0; // starts at starter card

  for (const entry of turnLog) {
    if (entry.playerId !== opponentId) {
      // Non-opponent plays still advance the top card
      if (entry.action.type === 'play') {
        topCardIndex++;
      }
      continue;
    }

    if (entry.action.type === 'draw') {
      // Opponent drew — they had nothing matching the current top card
      if (topCardIndex < discardPile.length) {
        pickTopCards.push(discardPile[topCardIndex]);
      }
    }

    if (entry.action.type === 'play') {
      // The card they played is the NEXT entry in the discard pile
      topCardIndex++;
      const playedCard = discardPile[topCardIndex];
      if (playedCard && playedCard.shape === 'whot' && entry.action.chosenShape) {
        suitCallHistory.push(entry.action.chosenShape);
      }
    }
  }

  // Determine dominant suit from call history
  let dominantSuit: Shape | null = null;
  if (suitCallHistory.length >= 2) {
    const counts = new Map<Shape, number>();
    for (const suit of suitCallHistory) {
      counts.set(suit, (counts.get(suit) ?? 0) + 1);
    }
    let maxCount = 0;
    for (const [suit, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominantSuit = suit;
      }
    }
  }

  // Build card probabilities
  const cardProbs = buildCardProbabilities(myHand, discardPile, pickTopCards, opponentHandSize);

  return {
    handSize: opponentHandSize,
    suitCallHistory,
    dominantSuit,
    pickTopCards,
    cardProbabilities: cardProbs,
  };
}

/**
 * Build probability map for each unseen card being in opponent's hand.
 * Uses Bayesian inference from pick events.
 */
function buildCardProbabilities(
  myHand: Card[],
  discardPile: Card[],
  pickTopCards: Card[],
  opponentHandSize: number,
): Map<CardKey, number> {
  const probs = new Map<CardKey, number>();

  // Count known cards
  const knownCounts = new Map<CardKey, number>();
  for (const card of myHand) {
    const key = cardKey(card);
    knownCounts.set(key, (knownCounts.get(key) ?? 0) + 1);
  }
  for (const card of discardPile) {
    const key = cardKey(card);
    knownCounts.set(key, (knownCounts.get(key) ?? 0) + 1);
  }

  // Count total of each card in full deck
  const deckCounts = new Map<CardKey, number>();
  for (const card of FULL_DECK) {
    const key = cardKey(card);
    deckCounts.set(key, (deckCounts.get(key) ?? 0) + 1);
  }

  // Compute unseen count per card key
  const unseenCounts = new Map<CardKey, number>();
  let totalUnseen = 0;
  for (const [key, total] of deckCounts) {
    const known = knownCounts.get(key) ?? 0;
    const unseen = Math.max(0, total - known);
    if (unseen > 0) {
      unseenCounts.set(key, unseen);
      totalUnseen += unseen;
    }
  }

  if (totalUnseen === 0) return probs;

  // Start with uniform prior: P(card in opponent hand) ∝ unseen count
  const baseProbPerCard = Math.min(1, opponentHandSize / totalUnseen);

  for (const [key, count] of unseenCounts) {
    probs.set(key, baseProbPerCard * count);
  }

  // Apply Bayesian updates from pick events
  // When opponent picked, they had NO card matching the top card's shape or number
  for (const topCard of pickTopCards) {
    // Cards the opponent demonstrably didn't have
    for (const [key] of unseenCounts) {
      const [shape, numStr] = key.split('-');
      const num = parseInt(numStr);

      const matchesShape = shape === topCard.shape || shape === 'whot';
      const matchesNumber = num === topCard.number;

      if (matchesShape || matchesNumber) {
        // Reduce probability significantly — they didn't have this
        const current = probs.get(key) ?? 0;
        probs.set(key, current * 0.05);
      }
    }
  }

  // Renormalise so total probability ≈ opponent hand size
  let totalProb = 0;
  for (const [, p] of probs) totalProb += p;

  if (totalProb > 0) {
    const scale = opponentHandSize / totalProb;
    for (const [key, p] of probs) {
      probs.set(key, Math.min(1, p * scale));
    }
  }

  return probs;
}

/**
 * Get the opponent's weakest suit — least called and least probable.
 * Used when AI plays Whot to maximise damage.
 */
export function getOpponentWeakestSuit(model: OpponentModel): Shape {
  const suitStrength = new Map<Shape, number>();

  for (const shape of SHAPES) {
    let strength = 0;
    // Strength from call history
    for (const called of model.suitCallHistory) {
      if (called === shape) strength += 3;
    }
    // Strength from card probabilities
    for (const [key, prob] of model.cardProbabilities) {
      if (key.startsWith(shape + '-')) {
        strength += prob;
      }
    }
    suitStrength.set(shape, strength);
  }

  let weakest: Shape = 'circle';
  let minStrength = Infinity;
  for (const [shape, strength] of suitStrength) {
    if (strength < minStrength) {
      minStrength = strength;
      weakest = shape;
    }
  }

  return weakest;
}

/**
 * Build a perfect opponent model when we can see their hand (impossible mode).
 * No inference needed — we know exactly what they have.
 */
export function buildPerfectOpponentModel(
  opponentHand: import('@/types/game').Card[],
  opponentHandSize: number,
): OpponentModel {
  const cardProbs = new Map<CardKey, number>();

  // Set exact probabilities: 1.0 for cards in hand, 0 for everything else
  for (const card of opponentHand) {
    const key = cardKey(card);
    cardProbs.set(key, (cardProbs.get(key) ?? 0) + 1);
  }

  // We know their hand perfectly — derive their dominant suit
  const suitCounts = new Map<string, number>();
  for (const card of opponentHand) {
    if (card.shape !== 'whot') {
      suitCounts.set(card.shape, (suitCounts.get(card.shape) ?? 0) + 1);
    }
  }

  let dominantSuit: import('@/types/game').Shape | null = null;
  let maxCount = 0;
  for (const [shape, count] of suitCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantSuit = shape as import('@/types/game').Shape;
    }
  }

  return {
    handSize: opponentHandSize,
    suitCallHistory: [],
    dominantSuit,
    pickTopCards: [],
    cardProbabilities: cardProbs,
  };
}
