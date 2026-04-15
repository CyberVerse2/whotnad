import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { matches } from '@/lib/db/schema';
import { eq, or, like, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const finishedMatches = await db
      .select({
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        winnerId: matches.winnerId,
        createdAt: matches.createdAt,
      })
      .from(matches)
      .where(eq(matches.status, 'finished'))
      .orderBy(desc(matches.createdAt));

    // Filter to matches involving an agent
    const agentMatches = finishedMatches.filter(
      (m) => m.player1Id.startsWith('agent-') || m.player2Id.startsWith('agent-')
    );

    let agentWins = 0;
    let agentLosses = 0;
    let currentStreak = 0;
    let streakCounting = true;

    for (const match of agentMatches) {
      const agentId = match.player1Id.startsWith('agent-') ? match.player1Id : match.player2Id;
      const agentWon = match.winnerId === agentId;

      if (agentWon) {
        agentWins++;
        if (streakCounting) currentStreak++;
      } else {
        agentLosses++;
        streakCounting = false;
      }
    }

    const totalGames = agentWins + agentLosses;
    const winRate = totalGames > 0 ? Math.round((agentWins / totalGames) * 100) : 0;

    return NextResponse.json({
      wins: agentWins,
      losses: agentLosses,
      winRate,
      streak: currentStreak,
      totalGames,
    });
  } catch (error) {
    console.error('Failed to fetch agent stats:', error);
    return NextResponse.json({ wins: 0, losses: 0, winRate: 0, streak: 0, totalGames: 0 });
  }
}
