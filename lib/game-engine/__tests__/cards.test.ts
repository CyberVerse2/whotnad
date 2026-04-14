import { describe, it, expect } from 'vitest';
import { createDeck, getCardValue, getHandValue, isSpecialCard } from '../cards';

describe('createDeck', () => {
  it('creates a 54-card deck', () => {
    const deck = createDeck();
    expect(deck.length).toBe(54);
  });

  it('has unique card IDs', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(54);
  });

  it('has correct suit distribution', () => {
    const deck = createDeck();
    const counts = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0, whot: 0 };
    for (const card of deck) {
      counts[card.shape]++;
    }
    expect(counts.circle).toBe(12);
    expect(counts.triangle).toBe(12);
    expect(counts.cross).toBe(9);
    expect(counts.square).toBe(9);
    expect(counts.star).toBe(7);
    expect(counts.whot).toBe(5);
  });

  it('has correct numbers for circle suit', () => {
    const deck = createDeck();
    const circleNumbers = deck
      .filter((c) => c.shape === 'circle')
      .map((c) => c.number)
      .sort((a, b) => a - b);
    expect(circleNumbers).toEqual([1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
  });

  it('has correct numbers for cross suit', () => {
    const deck = createDeck();
    const crossNumbers = deck
      .filter((c) => c.shape === 'cross')
      .map((c) => c.number)
      .sort((a, b) => a - b);
    expect(crossNumbers).toEqual([1, 2, 3, 5, 7, 10, 11, 13, 14]);
  });

  it('has correct numbers for star suit', () => {
    const deck = createDeck();
    const starNumbers = deck
      .filter((c) => c.shape === 'star')
      .map((c) => c.number)
      .sort((a, b) => a - b);
    expect(starNumbers).toEqual([1, 2, 3, 4, 5, 7, 8]);
  });

  it('all Whot cards have number 20', () => {
    const deck = createDeck();
    const whotCards = deck.filter((c) => c.shape === 'whot');
    expect(whotCards.every((c) => c.number === 20)).toBe(true);
  });
});

describe('getCardValue', () => {
  it('returns face value for normal suits', () => {
    expect(getCardValue({ id: 0, shape: 'circle', number: 7 })).toBe(7);
    expect(getCardValue({ id: 1, shape: 'cross', number: 14 })).toBe(14);
  });

  it('returns double value for star suit', () => {
    expect(getCardValue({ id: 0, shape: 'star', number: 5 })).toBe(10);
    expect(getCardValue({ id: 1, shape: 'star', number: 8 })).toBe(16);
  });

  it('returns 20 for Whot cards', () => {
    expect(getCardValue({ id: 0, shape: 'whot', number: 20 })).toBe(20);
  });
});

describe('getHandValue', () => {
  it('sums card values', () => {
    const hand = [
      { id: 0, shape: 'circle' as const, number: 5 },
      { id: 1, shape: 'star' as const, number: 3 },
      { id: 2, shape: 'whot' as const, number: 20 },
    ];
    // 5 + (3*2) + 20 = 31
    expect(getHandValue(hand)).toBe(31);
  });

  it('returns 0 for empty hand', () => {
    expect(getHandValue([])).toBe(0);
  });
});

describe('isSpecialCard', () => {
  it('identifies special cards', () => {
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 1 })).toBe(true);  // Hold On
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 2 })).toBe(true);  // Pick Two
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 5 })).toBe(false);  // 5 is not special
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 8 })).toBe(true);  // Suspension
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 14 })).toBe(true); // General Market
    expect(isSpecialCard({ id: 0, shape: 'whot', number: 20 })).toBe(true);   // Whot!
  });

  it('identifies non-special cards', () => {
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 3 })).toBe(false);
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 7 })).toBe(false);
    expect(isSpecialCard({ id: 0, shape: 'circle', number: 10 })).toBe(false);
  });
});
