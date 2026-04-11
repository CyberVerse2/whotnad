import type { MatchPoints } from '@/types/game';
import type { Card } from '@/types/game';
import { getHandValue } from './cards';

const BASE_WIN = 100;
const BASE_LOSS = 10;
const MAX_DOMINANCE = 60;
const MAX_SPEED = 40;
const MAX_POINTS = 200;

/**
 * Streak multiplier tiers.
 * Applied to the winner's match points based on their current win streak.
 */
function getStreakMultiplier(streak: number): number {
  if (streak >= 7) return 1.3;
  if (streak >= 5) return 1.2;
  if (streak >= 3) return 1.1;
  return 1.0;
}

/**
 * Calculate match points for winner and loser.
 *
 * Match Points = Base + Dominance Bonus + Speed Bonus
 * - Base: Win = 100, Loss = 10
 * - Dominance: Penalty value of loser's remaining cards (capped at 60)
 *   - Face value for most suits, double for Stars, 20 for Whot cards
 * - Speed: max(0, 40 - turns taken to win) (capped at 40)
 * - Max per game: 200pts
 *
 * Streak multiplier is applied on top.
 */
export function calculateMatchPoints(
  winnerId: string,
  loserId: string,
  loserHand: Card[],
  turnsTaken: number,
  winnerStreak: number
): MatchPoints {
  const dominanceBonus = Math.min(MAX_DOMINANCE, getHandValue(loserHand));
  const speedBonus = Math.min(MAX_SPEED, Math.max(0, MAX_SPEED - turnsTaken));
  const rawWinnerPoints = Math.min(MAX_POINTS, BASE_WIN + dominanceBonus + speedBonus);
  const streakMultiplier = getStreakMultiplier(winnerStreak);
  const winnerPoints = Math.round(rawWinnerPoints * streakMultiplier);

  return {
    winnerId,
    loserId,
    winnerPoints,
    loserPoints: BASE_LOSS,
    basePoints: BASE_WIN,
    dominanceBonus,
    speedBonus,
    streakMultiplier,
  };
}

export { BASE_WIN, BASE_LOSS, MAX_DOMINANCE, MAX_SPEED, MAX_POINTS, getStreakMultiplier };
