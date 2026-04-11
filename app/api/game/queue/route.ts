import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { joinQueue, leaveQueue, getQueueStatus, tryMatch } from '@/lib/game/store';
import { verifyRequest } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await joinQueue(privyUserId);

  if (result.status === 'queued') {
    const matchResult = await tryMatch();
    if (matchResult.matched) {
      const updated = await getQueueStatus(privyUserId);
      return NextResponse.json(updated);
    }
  }

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await tryMatch();

  const status = await getQueueStatus(privyUserId);
  return NextResponse.json(status);
}

export async function DELETE(request: NextRequest) {
  const privyUserId = await verifyRequest(request);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await leaveQueue(privyUserId);
  return NextResponse.json({ status: 'idle' });
}
