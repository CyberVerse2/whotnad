import { NextResponse } from 'next/server';
import { getPoolBalance, getAccumulatedRake } from '@/lib/chain/pool-wallet';

export async function GET() {
  try {
    const balance = await getPoolBalance();
    const rake = await getAccumulatedRake();
    return NextResponse.json({ balance, accumulatedRake: rake });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
