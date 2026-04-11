import { describe, it, expect } from 'vitest';
import { shuffleDeck, computeDeckHash } from '../shuffle';
import { createDeck } from '../cards';

describe('shuffleDeck', () => {
  it('returns all 54 cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, 'test-seed');
    expect(shuffled.length).toBe(54);
  });

  it('does not modify the original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck, 'test-seed');
    expect(deck).toEqual(original);
  });

  it('is deterministic — same seed produces same order', () => {
    const deck = createDeck();
    const a = shuffleDeck(deck, 'my-seed-123');
    const b = shuffleDeck(deck, 'my-seed-123');
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('different seeds produce different orders', () => {
    const deck = createDeck();
    const a = shuffleDeck(deck, 'seed-alpha');
    const b = shuffleDeck(deck, 'seed-beta');
    // Extremely unlikely to be the same
    const aIds = a.map((c) => c.id).join(',');
    const bIds = b.map((c) => c.id).join(',');
    expect(aIds).not.toBe(bIds);
  });

  it('actually shuffles the deck (not identity)', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, 'any-seed');
    const originalIds = deck.map((c) => c.id).join(',');
    const shuffledIds = shuffled.map((c) => c.id).join(',');
    expect(shuffledIds).not.toBe(originalIds);
  });

  it('preserves all card IDs', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, 'test');
    const originalIds = new Set(deck.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    expect(shuffledIds).toEqual(originalIds);
  });
});

describe('computeDeckHash', () => {
  it('returns a hex string', async () => {
    const deck = createDeck();
    const hash = await computeDeckHash(deck);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same deck produces same hash', async () => {
    const deck = createDeck();
    const a = await computeDeckHash(deck);
    const b = await computeDeckHash(deck);
    expect(a).toBe(b);
  });

  it('different deck orders produce different hashes', async () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, 'hash-test');
    const a = await computeDeckHash(deck);
    const b = await computeDeckHash(shuffled);
    expect(a).not.toBe(b);
  });
});
