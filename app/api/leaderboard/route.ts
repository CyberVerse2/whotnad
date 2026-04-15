import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { matches, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { GameState } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const difficulty = request.nextUrl.searchParams.get('difficulty') === 'nigerian' ? 'nigerian' : 'hard';

    const finishedMatches = await db
      .select({
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        winnerId: matches.winnerId,
        winnerPoints: matches.winnerPoints,
        loserPoints: matches.loserPoints,
        gameState: matches.gameState,
      })
      .from(matches)
      .where(eq(matches.status, 'finished'));

    // Aggregate per-player stats filtered by difficulty
    const playerStats = new Map<string, { wins: number; losses: number; totalPoints: number }>();

    for (const match of finishedMatches) {
      const state = match.gameState as GameState | null;
      const matchDifficulty = (state?.difficulty ?? 'hard') as string;
      // Nigerian mode includes old 'rigged' matches from before the rename
      if (difficulty === 'nigerian') {
        if (matchDifficulty !== 'nigerian' && matchDifficulty !== 'rigged') continue;
      } else {
        if (matchDifficulty !== difficulty) continue;
      }
      if (!match.winnerId) continue;

      for (const playerId of [match.player1Id, match.player2Id]) {
        if (playerId.startsWith('agent-')) continue;

        const stats = playerStats.get(playerId) ?? { wins: 0, losses: 0, totalPoints: 0 };
        if (playerId === match.winnerId) {
          stats.wins++;
          stats.totalPoints += match.winnerPoints ?? 0;
        } else {
          stats.losses++;
          stats.totalPoints += match.loserPoints ?? 0;
        }
        playerStats.set(playerId, stats);
      }
    }

    const sorted = [...playerStats.entries()]
      .sort(([, a], [, b]) => b.totalPoints - a.totalPoints)
      .slice(0, 50);

    // Build username map
    const allUsers = await db
      .select({ privyId: users.privyId, displayName: users.displayName })
      .from(users);

    const usernameMap = new Map<string, string>();
    for (const u of allUsers) {
      usernameMap.set(u.privyId, u.displayName ?? 'Player');
    }

    const entries = sorted.map(([privyId, stats], i) => ({
      rank: i + 1,
      username: usernameMap.get(privyId) ?? 'Player',
      wins: stats.wins,
      losses: stats.losses,
      totalPoints: stats.totalPoints,
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
    return NextResponse.json({ entries: [] });
  }
}
