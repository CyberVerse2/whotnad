import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { joinQueue, tryMatch } from '@/lib/game/store';

/**
 * POST /api/agent — Create an AI agent and queue it for matchmaking.
 *
 * The agent doesn't need a background loop. When a human player polls
 * for game state, the store detects it's the agent's turn and plays
 * the agent's move inline (see tickAgentTurn in store.ts).
 */
export async function POST(request: NextRequest) {
  const agentId = `agent-${randomUUID().slice(0, 8)}`;

  await joinQueue(agentId);
  await tryMatch();

  return NextResponse.json({
    agentId,
    status: 'queued',
    message: 'AI agent queued. Join from the lobby to start a match.',
  });
}
