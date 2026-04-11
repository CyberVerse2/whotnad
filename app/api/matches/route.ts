import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { matches, users } from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { verifyPrivyToken } from '@/lib/auth/privy';

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-privy-token');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claims = await verifyPrivyToken(token);
  if (!claims) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyId, claims.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get recent matches
  const recentMatches = await db
    .select()
    .from(matches)
    .where(or(eq(matches.player1Id, user.id), eq(matches.player2Id, user.id)))
    .orderBy(desc(matches.createdAt))
    .limit(20);

  return NextResponse.json({ matches: recentMatches });
}
