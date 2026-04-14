/**
 * Layer 5 — Special Card Doctrine
 *
 * Override rules for when to play each special card.
 * Returns a score modifier that adjusts Layer 2 valuations.
 * Positive = encourage play, negative = discourage.
 */

import type { Card, Shape } from '@/types/game';
import type { AIGameState, AIMove, OpponentModel } from './types';
import { SHAPES } from './types';

/**
 * Apply doctrine rules to a candidate move.
 * Returns a score modifier (added to Layer 2 score).
 * Large negative = strongly encourage playing this card now.
 * Large positive = strongly discourage.
 */
export function applyDoctrine(
  card: Card,
  state: AIGameState,
  model: OpponentModel,
  chosenShape?: Shape,
): number {
  switch (card.number) {
    case 14: return doctrineGeneralMarket(state, model);
    case 20: return doctrineWhot(card, state, model, chosenShape);
    case 2:  return doctrinePickTwo(state, model);
    case 1:  return doctrineHoldOn(state, model);
    default: return 0;
  }
}

/**
 * General Market (14):
 * - Encourage if hand ≥6 or opponent ≤4 cards (stall them)
 * - Discourage if deck < (opponents × 2) cards
 */
function doctrineGeneralMarket(state: AIGameState, model: OpponentModel): number {
  let modifier = 0;

  // Discourage with low deck
  if (state.deckSize < 4) {
    modifier += 15; // penalise
  }

  // Encourage to stall opponent near winning
  if (model.handSize <= 4) {
    modifier -= 12;
  }

  // Encourage when we have many cards (slow everyone down)
  if (state.hand.length >= 6) {
    modifier -= 8;
  }

  return modifier;
}

/**
 * Whot (20):
 * - Only encourage if suit chain is possible (2+ follow-ups)
 * - Or in blocking mode (opponent ≤2 cards)
 * - Or at ≤2 cards ourselves
 * - Otherwise discourage playing it
 */
function doctrineWhot(
  card: Card,
  state: AIGameState,
  model: OpponentModel,
  chosenShape?: Shape,
): number {
  // At ≤2 cards, Whot is crucial for winning
  if (state.hand.length <= 2) {
    return -25;
  }

  // Blocking mode: opponent near winning
  if (model.handSize <= 2) {
    return -20;
  }

  // Check for suit chain: can we follow up with 2+ cards of chosen shape?
  if (chosenShape) {
    const followUps = state.hand.filter(
      (c) => c.id !== card.id && c.shape === chosenShape
    ).length;

    if (followUps >= 2) return -15;
    if (followUps === 1) return -5;
  }

  // No good reason to play Whot yet — penalise
  return 10;
}

/**
 * Pick Two (2):
 * - Hold for when opponent is near winning (≤2 cards)
 * - Or when behind in hand size (momentum swing)
 * - Don't burn early when impact is minor
 */
function doctrinePickTwo(state: AIGameState, model: OpponentModel): number {
  // Blocking mode: opponent near winning
  if (model.handSize <= 2) {
    return -25; // strong encourage
  }

  // Behind in hand size — good time to attack
  if (state.hand.length > model.handSize + 2) {
    return -10;
  }

  // Early game with large hands — minimal impact, save it
  if (model.handSize >= 6 && state.hand.length >= 6) {
    return 8; // mild discourage
  }

  return 0;
}

/**
 * Hold On (1):
 * - Play immediately if opponent ≤2 cards
 * - Otherwise hold for endgame (hand ≤4)
 * - Exception: play if it enables a suit chain
 */
function doctrineHoldOn(state: AIGameState, model: OpponentModel): number {
  // Blocking mode: play immediately
  if (model.handSize <= 2) {
    return -25;
  }

  // Endgame: play to maintain tempo
  if (state.hand.length <= 4) {
    return -10;
  }

  // Mid-game: mild hold
  return 5;
}
