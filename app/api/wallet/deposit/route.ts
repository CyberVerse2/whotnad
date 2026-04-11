import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOnChainMatch, matchIdToBytes32 } from '@/lib/chain/pool-wallet';

/**
 * POST /api/wallet/deposit — Check if a match is funded on-chain.
 * Players deposit directly to the TournamentPool contract.
 * This endpoint verifies the on-chain state.
 */
export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId required' },
        { status: 400 }
      );
    }

    const contractMatchId = matchIdToBytes32(matchId);
    const onChainMatch = await getOnChainMatch(contractMatchId);

    const status = Number(onChainMatch.status);
    const funded = status >= 2;
    const fundedAt = Number(onChainMatch.fundedAt);
    const now = Math.floor(Date.now() / 1000);
    const refundable =
      status === 1 ||
      (status === 2 && fundedAt > 0 && now >= fundedAt + (2 * 60 * 60));

    return NextResponse.json({
      funded,
      refundable,
      player1: onChainMatch.player1,
      player2: onChainMatch.player2,
      status,
      fundedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check deposit status' },
      { status: 500 }
    );
  }
}
