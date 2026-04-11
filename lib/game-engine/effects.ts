import type { Card, GameState, Shape } from '@/types/game';

/**
 * Apply the effect of a special card after it's been played.
 * Returns the modified game state.
 *
 * Special cards:
 *  1  → Hold On: skip opponent's turn
 *  2  → Pick Two: opponent draws 2 (stackable)
 *  8  → Suspension: skip opponent's turn
 * 14  → General Market: opponent draws 1
 * 20  → Whot!: wild card, caller names next shape
 */
export function applyCardEffect(
  state: GameState,
  card: Card,
  chosenShape?: Shape
): GameState {
  const next = { ...state };

  switch (card.number) {
    case 1: // Hold On — skip opponent
      next.currentPlayerIndex = advancePlayer(next);
      break;

    case 2: // Pick Two — stackable
      next.pendingDraws += 2;
      next.pendingDrawType = 2;
      break;

    case 8: // Suspension — skip opponent
      next.currentPlayerIndex = advancePlayer(next);
      break;

    case 14: { // General Market — opponent draws 1
      const opponentIndex = getNextPlayerIndex(next);
      const opponentId = next.playerOrder[opponentIndex];
      next.hands = { ...next.hands };
      next.hands[opponentId] = [...next.hands[opponentId]];
      next.deck = [...next.deck];

      if (next.deck.length > 0) {
        const drawnCard = next.deck.pop()!;
        next.hands[opponentId].push(drawnCard);
      } else {
        recycleDiscardPile(next);
        if (next.deck.length > 0) {
          const drawnCard = next.deck.pop()!;
          next.hands[opponentId].push(drawnCard);
        }
      }
      break;
    }

    case 20: // Whot! — wild, set active shape
      if (!chosenShape) {
        throw new Error('Must choose a shape when playing Whot card');
      }
      next.activeShape = chosenShape;
      break;
  }

  return next;
}

/**
 * Resolve pending draws for the current player (when they can't stack).
 */
export function resolvePendingDraws(state: GameState): GameState {
  if (state.pendingDraws === 0) return state;

  const next = { ...state };
  const playerId = next.playerOrder[next.currentPlayerIndex];
  next.hands = { ...next.hands };
  next.hands[playerId] = [...next.hands[playerId]];
  next.deck = [...next.deck];

  for (let i = 0; i < state.pendingDraws; i++) {
    if (next.deck.length === 0) {
      recycleDiscardPile(next);
    }
    if (next.deck.length > 0) {
      const card = next.deck.pop()!;
      next.hands[playerId].push(card);
    }
  }

  next.pendingDraws = 0;
  next.pendingDrawType = null;
  return next;
}

function getNextPlayerIndex(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.playerOrder.length;
}

function advancePlayer(state: GameState): number {
  // Skip the next player (already advancing once in the normal turn flow)
  // So we advance one extra time here
  return (state.currentPlayerIndex + 1) % state.playerOrder.length;
}

/**
 * Recycle the discard pile back into the deck when the deck runs out.
 * Keeps the top card on the discard pile.
 */
function recycleDiscardPile(state: GameState): void {
  if (state.discardPile.length <= 1) return;

  const topCard = state.discardPile[state.discardPile.length - 1];
  const recycled = state.discardPile.slice(0, -1);
  state.deck = recycled;
  state.discardPile = [topCard];
}
