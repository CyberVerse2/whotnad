import { describe, it, expect } from 'vitest';
import { isValidPlay, getPlayableCards, mustDraw } from '../rules';
import type { Card, GameState } from '@/types/game';

const card = (shape: Card['shape'], number: number, id = 0): Card => ({
  id,
  shape,
  number,
});

describe('isValidPlay', () => {
  it('allows matching by shape', () => {
    expect(isValidPlay(card('circle', 7), card('circle', 3), null, 0, null)).toBe(true);
  });

  it('allows matching by number', () => {
    expect(isValidPlay(card('circle', 7), card('triangle', 7), null, 0, null)).toBe(true);
  });

  it('rejects non-matching card', () => {
    expect(isValidPlay(card('circle', 7), card('triangle', 3), null, 0, null)).toBe(false);
  });

  it('always allows Whot card', () => {
    expect(isValidPlay(card('circle', 7), card('whot', 20), null, 0, null)).toBe(true);
    expect(isValidPlay(card('star', 3), card('whot', 20), null, 0, null)).toBe(true);
  });

  it('respects active shape from Whot card', () => {
    expect(isValidPlay(card('whot', 20), card('circle', 5), 'circle', 0, null)).toBe(true);
    expect(isValidPlay(card('whot', 20), card('triangle', 5), 'circle', 0, null)).toBe(false);
  });

  it('during Pick Two pending, only allows stacking Pick Two', () => {
    expect(isValidPlay(card('circle', 2), card('triangle', 2), null, 2, 2)).toBe(true);
    expect(isValidPlay(card('circle', 2), card('circle', 7), null, 2, 2)).toBe(false);
    expect(isValidPlay(card('circle', 2), card('whot', 20), null, 2, 2)).toBe(false);
  });

  it('during Pick Three pending, only allows stacking Pick Three', () => {
    expect(isValidPlay(card('circle', 5), card('star', 5), null, 3, 5)).toBe(true);
    expect(isValidPlay(card('circle', 5), card('circle', 7), null, 3, 5)).toBe(false);
  });
});

describe('getPlayableCards', () => {
  it('returns matching cards', () => {
    const hand = [
      card('circle', 3, 0),
      card('triangle', 7, 1),
      card('cross', 10, 2),
    ];
    const top = card('circle', 7);
    const playable = getPlayableCards(hand, top, null, 0, null);
    // circle matches shape, triangle 7 matches number
    expect(playable.map((c) => c.id)).toEqual([0, 1]);
  });

  it('returns empty when no cards match', () => {
    const hand = [
      card('square', 3, 0),
      card('cross', 10, 1),
    ];
    const top = card('circle', 7);
    const playable = getPlayableCards(hand, top, null, 0, null);
    expect(playable).toEqual([]);
  });

  it('always includes Whot cards', () => {
    const hand = [
      card('square', 3, 0),
      card('whot', 20, 1),
    ];
    const top = card('circle', 7);
    const playable = getPlayableCards(hand, top, null, 0, null);
    expect(playable.map((c) => c.id)).toEqual([1]);
  });
});

describe('mustDraw', () => {
  it('returns true when no playable cards', () => {
    const state = {
      hands: { p1: [card('square', 3, 0)] },
      discardPile: [card('circle', 7)],
      activeShape: null,
      pendingDraws: 0,
      pendingDrawType: null,
    } as unknown as GameState;
    expect(mustDraw(state, 'p1')).toBe(true);
  });

  it('returns false when there are playable cards', () => {
    const state = {
      hands: { p1: [card('circle', 3, 0)] },
      discardPile: [card('circle', 7)],
      activeShape: null,
      pendingDraws: 0,
      pendingDrawType: null,
    } as unknown as GameState;
    expect(mustDraw(state, 'p1')).toBe(false);
  });
});

