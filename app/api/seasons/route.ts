import { NextResponse } from 'next/server';
import { getCurrentSeason } from '@/lib/seasons/manager';

export async function GET() {
  try {
    const season = await getCurrentSeason();
    return NextResponse.json({ season });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get current season' },
      { status: 500 }
    );
  }
}
