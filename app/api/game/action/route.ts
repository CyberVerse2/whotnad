import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { playCard, drawCard, declareLastCard } from '@/lib/game/store';
import { verifyRequest } from '@/lib/auth/verify-request';
import type { Shape } from '@/types/game';

interface ActionBody {
  matchId: string;
  action: 'play' | 'draw' | 'declare_last_card';
  cardId?: number;
  chosenShape?: Shape;
}

export async function POST(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: ActionBody = await request.json();
  const { matchId, action, cardId, chosenShape } = body;

  if (!matchId || !action) {
    return NextResponse.json(
      { error: 'matchId and action required' },
      { status: 400 }
    );
  }

  let result: { success: boolean; error?: string };

  switch (action) {
    case 'play':
      if (cardId === undefined) {
        return NextResponse.json(
          { error: 'cardId required for play action' },
          { status: 400 }
        );
      }
      result = await playCard(matchId, privyUserId, cardId, chosenShape);
      break;

    case 'draw':
      result = await drawCard(matchId, privyUserId);
      break;

    case 'declare_last_card':
      result = await declareLastCard(matchId, privyUserId);
      break;

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
