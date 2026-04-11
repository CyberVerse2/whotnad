import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getGameState } from '@/lib/game/store';
import { verifyRequest } from '@/lib/auth/verify-request';

export async function GET(request: NextRequest) {
  try {
    const privyUserId = await verifyRequest(request);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const matchId = request.nextUrl.searchParams.get('matchId');
    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    const result = await getGameState(matchId, privyUserId);
    if (!result) {
      return NextResponse.json(
        { error: 'Game not found or not a participant' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get game state', error);
    return NextResponse.json({ error: 'Failed to load game state' }, { status: 500 });
  }
}
