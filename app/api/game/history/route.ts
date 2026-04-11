import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserMatches } from '@/lib/game/store';
import { verifyRequest } from '@/lib/auth/verify-request';

export async function GET(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const matchHistory = await getUserMatches(privyUserId);
  return NextResponse.json({ matches: matchHistory });
}
