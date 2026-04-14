import type { Card, Shape, CardShape, GameLogEntry } from '@/types/game';

/** Unique string key for a card: "circle-5", "whot-20", etc. */
export type CardKey = string;

export function cardKey(card: { shape: string; number: number }): CardKey {
  return `${card.shape}-${card.number}`;
}

/** AI's internal rich game state — built from AgentGameView each turn. */
export interface AIGameState {
  hand: Card[];
  topCard: Card;
  calledSuit: Shape | null;
  opponentHandSize: number;
  deckSize: number;
  playedCards: Card[];
  unseenCards: Card[];
  turnHistory: GameLogEntry[];
  pendingDraws: number;
  pendingDrawType: 2 | null;
  turnCount: number;
  opponentId: string;
  agentId: string;
}

/** Per-opponent behavioral model. */
export interface OpponentModel {
  handSize: number;
  suitCallHistory: Shape[];           // shapes they called on Whot plays
  dominantSuit: Shape | null;         // most-called suit (null if <2 calls)
  pickTopCards: Card[];               // top card at the moment they drew (they had nothing matching)
  cardProbabilities: Map<CardKey, number>;  // probability each unseen card is in their hand
}

/** Move the AI can make. */
export interface AIMove {
  action: 'play' | 'draw';
  cardId?: number;
  chosenShape?: Shape;
}

/** Lightweight simulation state for MCTS rollouts. */
export interface SimState {
  hands: Card[][];            // [0] = AI, [1] = opponent
  deck: Card[];
  discardPile: Card[];
  topCard: Card;
  activeShape: Shape | null;
  pendingDraws: number;
  pendingDrawType: 2 | null;
  currentPlayer: 0 | 1;      // index into hands
  turnCount: number;
  winner: 0 | 1 | null;
}

/** Full deck definition — all 54 Whot cards. */
export const FULL_DECK: ReadonlyArray<{ shape: CardShape; number: number }> = (() => {
  const cards: { shape: CardShape; number: number }[] = [];
  const SHAPES: Record<string, number[]> = {
    circle:   [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    cross:    [1, 2, 3, 5, 7, 10, 11, 13, 14],
    square:   [1, 2, 3, 5, 7, 10, 11, 13, 14],
    star:     [1, 2, 3, 4, 5, 7, 8],
  };
  for (const [shape, numbers] of Object.entries(SHAPES)) {
    for (const number of numbers) {
      cards.push({ shape: shape as CardShape, number });
    }
  }
  // 5 Whot wild cards
  for (let i = 0; i < 5; i++) {
    cards.push({ shape: 'whot', number: 20 });
  }
  return cards;
})();

export const SHAPES: Shape[] = ['circle', 'triangle', 'cross', 'square', 'star'];
