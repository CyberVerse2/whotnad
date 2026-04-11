import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { forfeitGame, getGameState } from '@/lib/game/store';
import { verifyRequest } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  try {
    const privyUserId = await verifyRequest(request);
    if (!privyUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchId } = await request.json();
    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    const result = await forfeitGame(matchId, privyUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const gameState = await getGameState(matchId, privyUserId);
    if (!gameState) {
      return NextResponse.json({ error: 'Failed to load updated game state' }, { status: 500 });
    }

    return NextResponse.json(gameState);
  } catch (error) {
    console.error('Forfeit failed:', error);
    return NextResponse.json({ error: 'Failed to forfeit' }, { status: 500 });
  }
}
