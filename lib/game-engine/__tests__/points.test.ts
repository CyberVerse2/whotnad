import { describe, it, expect } from 'vitest';
import { calculateMatchPoints, getStreakMultiplier } from '../points';
import type { Card } from '@/types/game';

const card = (shape: Card['shape'], number: number): Card => ({
  id: 0,
  shape,
  number,
});

describe('getStreakMultiplier', () => {
  it('returns 1.0 for streaks 0-2', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(1)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.0);
  });

  it('returns 1.1 for streaks 3-4', () => {
    expect(getStreakMultiplier(3)).toBe(1.1);
    expect(getStreakMultiplier(4)).toBe(1.1);
  });

  it('returns 1.2 for streaks 5-6', () => {
    expect(getStreakMultiplier(5)).toBe(1.2);
    expect(getStreakMultiplier(6)).toBe(1.2);
  });

  it('returns 1.3 for streaks 7+', () => {
    expect(getStreakMultiplier(7)).toBe(1.3);
    expect(getStreakMultiplier(10)).toBe(1.3);
    expect(getStreakMultiplier(100)).toBe(1.3);
  });
});

describe('calculateMatchPoints', () => {
  it('awards base 100 to winner and 10 to loser', () => {
    const result = calculateMatchPoints(
      'winner',
      'loser',
      [card('circle', 3)], // small hand value
      40, // no speed bonus (40 - 40 = 0)
      0 // no streak
    );
    expect(result.winnerPoints).toBeGreaterThanOrEqual(100);
    expect(result.loserPoints).toBe(10);
  });

  it('calculates dominance bonus from loser hand value', () => {
    const loserHand = [
      card('circle', 10), // 10
      card('star', 5),    // 10 (double for star)
      card('whot', 20),   // 20
    ];
    // Total hand value = 40
    const result = calculateMatchPoints('w', 'l', loserHand, 40, 0);
    expect(result.dominanceBonus).toBe(40);
  });

  it('caps dominance bonus at 60', () => {
    const loserHand = [
      card('whot', 20), // 20
      card('whot', 20), // 20
      card('whot', 20), // 20
      card('whot', 20), // 20 — total 80, capped at 60
    ];
    const result = calculateMatchPoints('w', 'l', loserHand, 40, 0);
    expect(result.dominanceBonus).toBe(60);
  });

  it('calculates speed bonus correctly', () => {
    // Speed = max(0, 40 - turns)
    const fast = calculateMatchPoints('w', 'l', [], 10, 0);
    expect(fast.speedBonus).toBe(30); // 40 - 10

    const slow = calculateMatchPoints('w', 'l', [], 50, 0);
    expect(slow.speedBonus).toBe(0); // 40 - 50 = negative, capped at 0
  });

  it('caps speed bonus at 40', () => {
    const result = calculateMatchPoints('w', 'l', [], 0, 0);
    expect(result.speedBonus).toBe(40);
  });

  it('caps total at 200 before streak multiplier', () => {
    // Max: 100 base + 60 dominance + 40 speed = 200
    const loserHand = [
      card('whot', 20),
      card('whot', 20),
      card('whot', 20),
      card('whot', 20),
    ];
    const result = calculateMatchPoints('w', 'l', loserHand, 0, 0);
    expect(result.winnerPoints).toBe(200); // capped at 200, 1.0x multiplier
  });

  it('applies streak multiplier', () => {
    const result = calculateMatchPoints('w', 'l', [], 40, 5); // 1.2x
    // Base 100 + 0 dominance + 0 speed = 100 * 1.2 = 120
    expect(result.winnerPoints).toBe(120);
    expect(result.streakMultiplier).toBe(1.2);
  });

  it('max points with max streak: 200 * 1.3 = 260', () => {
    const loserHand = [
      card('whot', 20),
      card('whot', 20),
      card('whot', 20),
      card('whot', 20),
    ];
    const result = calculateMatchPoints('w', 'l', loserHand, 0, 7);
    expect(result.winnerPoints).toBe(260);
  });
});
