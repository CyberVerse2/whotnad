import type { Card, GameState, Shape } from '@/types/game';

/**
 * Check if a card can be played on the current discard pile top.
 * Matching is by shape or number. Whot (20) is always playable.
 * During pending draws (Pick Two/Three), only matching pick cards can be stacked.
 */
export function isValidPlay(
  topCard: Card,
  playedCard: Card,
  activeShape: Shape | null,
  pendingDraws: number,
  pendingDrawType: 2 | null
): boolean {
  // During pending draws, can only stack same type
  if (pendingDraws > 0 && pendingDrawType !== null) {
    return playedCard.number === pendingDrawType;
  }

  // Whot card is always playable
  if (playedCard.shape === 'whot') return true;

  // If active shape is set (from Whot card), must match that shape
  if (activeShape !== null) {
    return playedCard.shape === activeShape;
  }

  // Match by shape or number
  if (topCard.shape === 'whot') {
    // After a Whot with no active shape set (shouldn't happen in normal play)
    return true;
  }

  return playedCard.shape === topCard.shape || playedCard.number === topCard.number;
}

/**
 * Get all playable cards from a hand given the current game state.
 */
export function getPlayableCards(
  hand: Card[],
  topCard: Card,
  activeShape: Shape | null,
  pendingDraws: number,
  pendingDrawType: 2 | null
): Card[] {
  return hand.filter((card) =>
    isValidPlay(topCard, card, activeShape, pendingDraws, pendingDrawType)
  );
}

/**
 * Check if a player must draw (has no playable cards and no pending forced draws).
 */
export function mustDraw(state: GameState, playerId: string): boolean {
  const hand = state.hands[playerId];
  if (!hand || hand.length === 0) return false;

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!topCard) return false;

  const playable = getPlayableCards(
    hand,
    topCard,
    state.activeShape,
    state.pendingDraws,
    state.pendingDrawType
  );

  return playable.length === 0;
}

/**
 * Check if the player needs to declare "Last Card" before playing.
 * Required when player has exactly 2 cards and is about to play one.
 */
export function needsLastCardDeclaration(state: GameState, playerId: string): boolean {
  const hand = state.hands[playerId];
  return hand.length === 2 && !state.lastCardDeclared[playerId];
}

/**
 * Get the number of cards a player must draw for pending effects.
 */
export function getPendingDrawCount(state: GameState): number {
  return state.pendingDraws;
}
