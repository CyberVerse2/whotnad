import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyPrivyToken, syncUserFromClaims } from '@/lib/auth/privy';

export async function GET(request: NextRequest) {
  const token =
    request.headers.get('x-privy-token') ??
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claims = await verifyPrivyToken(token);
  if (!claims) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const privyId = claims.userId;
  const user = await syncUserFromClaims(claims);
  if (!user) {
    return NextResponse.json({ error: `Could not sync user ${privyId}` }, { status: 500 });
  }

  return NextResponse.json({ user });
}
