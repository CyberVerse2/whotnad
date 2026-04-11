import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rotateSeason } from '@/lib/seasons/manager';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newSeason = await rotateSeason();
    return NextResponse.json({ season: newSeason });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to rotate season' },
      { status: 500 }
    );
  }
}
