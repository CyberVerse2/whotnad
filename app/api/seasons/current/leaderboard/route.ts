import { NextResponse } from 'next/server';
import { getCurrentSeason, getLeaderboard } from '@/lib/seasons/manager';

export async function GET() {
  try {
    const season = await getCurrentSeason();
    const leaderboard = await getLeaderboard(season.id);
    return NextResponse.json({ season, leaderboard });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    );
  }
}
