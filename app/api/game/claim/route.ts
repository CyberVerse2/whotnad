import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { matches, users } from '@/lib/db/schema';
import { verifyRequest } from '@/lib/auth/verify-request';
import { markMatchClaimed } from '@/lib/game/store';
import { getOnChainMatch } from '@/lib/chain/pool-wallet';
import { and, eq } from 'drizzle-orm';

interface ClaimBody {
  matchId: string;
}

export async function POST(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as ClaimBody;
  if (!body.matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }

  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, body.matchId), eq(matches.winnerId, privyUserId)))
    .limit(1);

  if (!match) {
    return NextResponse.json({ error: 'Winning match not found' }, { status: 404 });
  }

  if (match.claimed) {
    return NextResponse.json({ success: true, claimed: true });
  }

  if (!match.contractMatchId) {
    return NextResponse.json({ error: 'Match is not claimable' }, { status: 400 });
  }

  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.privyId, privyUserId))
    .limit(1);

  if (!user?.walletAddress) {
    return NextResponse.json({ error: 'Wallet address not found' }, { status: 400 });
  }

  const onChainMatch = await getOnChainMatch(match.contractMatchId as `0x${string}`);
  const onChainStatus = Number(onChainMatch.status);

  if (onChainStatus !== 4) {
    return NextResponse.json(
      { error: `Claim has not been finalized on-chain yet (status ${onChainStatus})` },
      { status: 409 }
    );
  }

  if (onChainMatch.winner.toLowerCase() !== user.walletAddress.toLowerCase()) {
    return NextResponse.json({ error: 'Claim winner does not match your wallet' }, { status: 403 });
  }

  await markMatchClaimed(match.id);

  return NextResponse.json({ success: true, claimed: true });
}
