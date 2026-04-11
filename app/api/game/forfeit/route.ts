import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { forfeitGame } from '@/lib/game/store';
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forfeit failed:', error);
    return NextResponse.json({ error: 'Failed to forfeit' }, { status: 500 });
  }
}
