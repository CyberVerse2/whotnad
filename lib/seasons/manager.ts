import { db } from '@/lib/db';
import { seasons, seasonPoints, badges, matches } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

/**
 * Get the current active season, creating one if none exists.
 */
export async function getCurrentSeason() {
  const [active] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.status, 'active'))
    .limit(1);

  if (active) return active;

  // Create a new season starting now, ending next Monday
  const now = new Date();
  const nextMonday = getNextMonday(now);

  const [newSeason] = await db
    .insert(seasons)
    .values({
      startDate: now,
      endDate: nextMonday,
      status: 'active',
    })
    .returning();

  return newSeason;
}

/**
 * Rotate the season: mark current as completed, assign badges, create new.
 */
export async function rotateSeason() {
  const current = await getCurrentSeason();

  // Mark as completed
  await db
    .update(seasons)
    .set({ status: 'completed' })
    .where(eq(seasons.id, current.id));

  // Assign badges
  await assignBadges(current.id);

  // Create new season
  const now = new Date();
  const nextMonday = getNextMonday(now);

  const [newSeason] = await db
    .insert(seasons)
    .values({
      startDate: now,
      endDate: nextMonday,
      status: 'active',
    })
    .returning();

  return newSeason;
}

/**
 * Get leaderboard for a season.
 */
export async function getLeaderboard(seasonId: string, limit = 50) {
  return db
    .select()
    .from(seasonPoints)
    .where(eq(seasonPoints.seasonId, seasonId))
    .orderBy(desc(seasonPoints.totalPoints))
    .limit(limit);
}

/**
 * Update season points for a single player after a match.
 * Agents are skipped — callers should resolve privy IDs to user UUIDs
 * and only call this for real users.
 */
export async function updateSeasonPoints(
  seasonId: string,
  userId: string,
  points: number,
  isWin: boolean
) {
  if (isWin) {
    await db
      .insert(seasonPoints)
      .values({
        seasonId,
        userId,
        totalPoints: points,
        wins: 1,
        losses: 0,
        currentStreak: 1,
        maxStreak: 1,
      })
      .onConflictDoUpdate({
        target: [seasonPoints.seasonId, seasonPoints.userId],
        set: {
          totalPoints: sql`${seasonPoints.totalPoints} + ${points}`,
          wins: sql`${seasonPoints.wins} + 1`,
          currentStreak: sql`${seasonPoints.currentStreak} + 1`,
          maxStreak: sql`GREATEST(${seasonPoints.maxStreak}, ${seasonPoints.currentStreak} + 1)`,
        },
      });
  } else {
    await db
      .insert(seasonPoints)
      .values({
        seasonId,
        userId,
        totalPoints: points,
        wins: 0,
        losses: 1,
        currentStreak: 0,
        maxStreak: 0,
      })
      .onConflictDoUpdate({
        target: [seasonPoints.seasonId, seasonPoints.userId],
        set: {
          totalPoints: sql`${seasonPoints.totalPoints} + ${points}`,
          losses: sql`${seasonPoints.losses} + 1`,
          currentStreak: sql`0`,
        },
      });
  }
}

/**
 * Assign season-end badges.
 */
async function assignBadges(seasonId: string) {
  const leaderboard = await getLeaderboard(seasonId, 100);

  if (leaderboard.length === 0) return;

  const badgesToInsert: Array<{
    userId: string;
    seasonId: string;
    badgeType: 'champion' | 'speedster' | 'ruthless' | 'unstoppable' | 'agent_slayer' | 'veteran';
  }> = [];

  // Champion: #1 on leaderboard
  badgesToInsert.push({
    userId: leaderboard[0].userId,
    seasonId,
    badgeType: 'champion',
  });

  // Unstoppable: longest win streak
  const maxStreakPlayer = leaderboard.reduce((best, p) =>
    p.maxStreak > best.maxStreak ? p : best
  );
  if (maxStreakPlayer.maxStreak >= 3) {
    badgesToInsert.push({
      userId: maxStreakPlayer.userId,
      seasonId,
      badgeType: 'unstoppable',
    });
  }

  // Insert all badges
  if (badgesToInsert.length > 0) {
    await db.insert(badges).values(badgesToInsert);
  }
}

function getNextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}
