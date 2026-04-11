import type { Card, CardShape, Shape } from '@/types/game';

/**
 * Standard Nigerian Whot deck composition.
 * 54 cards total: 5 suits with specific number distributions + 5 Whot wild cards.
 */
const SUIT_NUMBERS: Record<Shape, number[]> = {
  circle:   [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross:    [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square:   [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star:     [1, 2, 3, 4, 5, 7, 8],
};

const WHOT_COUNT = 5;

export function createDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;

  for (const [shape, numbers] of Object.entries(SUIT_NUMBERS)) {
    for (const number of numbers) {
      cards.push({ id: id++, shape: shape as CardShape, number });
    }
  }

  for (let i = 0; i < WHOT_COUNT; i++) {
    cards.push({ id: id++, shape: 'whot', number: 20 });
  }

  return cards;
}

export function getCardValue(card: Card): number {
  if (card.shape === 'whot') return 20;
  if (card.shape === 'star') return card.number * 2;
  return card.number;
}

export function getHandValue(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + getCardValue(card), 0);
}

export function isSpecialCard(card: Card): boolean {
  return [1, 2, 5, 8, 14, 20].includes(card.number);
}

export function getCardLabel(card: Card): string {
  if (card.shape === 'whot') return 'Whot! 20';
  return `${card.shape} ${card.number}`;
}

export { SUIT_NUMBERS, WHOT_COUNT };
