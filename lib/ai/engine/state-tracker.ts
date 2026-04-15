/**
 * Layer 1 — Game State Representation
 *
 * Builds the rich AIGameState from the AgentGameView.
 * Computes unseen cards and initialises opponent model.
 */

import type { AgentGameView } from '@/types/game';
import type { AIGameState } from './types';
import { FULL_DECK, cardKey } from './types';
import { buildOpponentModel } from './opponent-model';

export function buildAIState(view: AgentGameView): AIGameState {
  // Track by cardKey — for Whot cards (duplicates) we need count-based tracking
  const knownCounts = new Map<string, number>();

  for (const card of view.myHand) {
    const key = cardKey(card);
    knownCounts.set(key, (knownCounts.get(key) ?? 0) + 1);
  }
  for (const card of view.discardPile) {
    const key = cardKey(card);
    knownCounts.set(key, (knownCounts.get(key) ?? 0) + 1);
  }

  // Compute unseen cards: full deck minus known cards
  const fullDeckCounts = new Map<string, number>();
  for (const card of FULL_DECK) {
    const key = cardKey(card);
    fullDeckCounts.set(key, (fullDeckCounts.get(key) ?? 0) + 1);
  }

  const unseenCards: AgentGameView['myHand'] = [];
  const unseenCounts = new Map<string, number>();
  for (const [key, total] of fullDeckCounts) {
    const known = knownCounts.get(key) ?? 0;
    const unseen = total - known;
    if (unseen > 0) {
      unseenCounts.set(key, unseen);
    }
  }

  // Reconstruct unseen cards as Card-like objects (without unique IDs — used for simulation)
  let nextFakeId = 1000;
  for (const [key, count] of unseenCounts) {
    const [shape, numStr] = key.split('-');
    for (let i = 0; i < count; i++) {
      unseenCards.push({ id: nextFakeId++, shape: shape as any, number: parseInt(numStr) });
    }
  }

  const agentId = view.currentPlayerId;

  return {
    hand: view.myHand,
    topCard: view.topCard,
    calledSuit: view.activeShape,
    opponentHandSize: view.opponentCardCount,
    deckSize: view.deckSize,
    playedCards: view.discardPile,
    unseenCards,
    turnHistory: view.turnLog,
    pendingDraws: view.pendingDraws,
    pendingDrawType: view.pendingDrawType,
    turnCount: view.turnCount,
    opponentId: view.opponentId,
    agentId,
  };
}
