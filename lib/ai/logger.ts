import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { PlayerGameView } from '@/types/messages';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'agent.log');

function ensureDir() {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch { /* already exists */ }
}

function timestamp(): string {
  return new Date().toISOString();
}

function write(entry: string) {
  ensureDir();
  appendFileSync(LOG_FILE, entry + '\n');
}

export function logAgentThinking(matchId: string, agentId: string, state: PlayerGameView, prompt: string) {
  const handSummary = state.myHand
    .map((c) => `${c.shape === 'whot' ? 'Whot!' : c.shape} ${c.number} [id:${c.id}]`)
    .join(', ');

  write(`
════════════════════════════════════════════════════════════
[${timestamp()}] AGENT THINKING — Match: ${matchId}
────────────────────────────────────────────────────────────
Agent:          ${agentId}
Turn:           ${state.turnCount}
Top card:       ${state.topCard.shape} ${state.topCard.number}
Active shape:   ${state.activeShape ?? 'none'}
Pending draws:  ${state.pendingDraws}
My hand (${state.myHand.length}): ${handSummary}
Opponent cards: ${state.opponentCardCount}
Deck remaining: ${state.deckSize}
PROMPT SENT:
${prompt}
────────────────────────────────────────────────────────────`);
}

export function logAgentResponse(matchId: string, agentId: string, rawResponse: string, parsedMove: { action: string; cardId?: number; chosenShape?: string }) {
  write(`[${timestamp()}] AGENT RESPONSE — Match: ${matchId}
  Raw:    ${rawResponse}
  Parsed: action=${parsedMove.action} cardId=${parsedMove.cardId ?? 'none'} shape=${parsedMove.chosenShape ?? 'none'}`);
}

export function logAgentThoughtTrace(matchId: string, agentId: string, thought: string, thinkMs: number) {
  write(`[${timestamp()}] AGENT THOUGHT — Match: ${matchId}
  Agent:    ${agentId}
  Think ms: ${thinkMs}
  Thought:  "${thought}"`);
}

export function logAgentAction(matchId: string, agentId: string, action: string, success: boolean, detail?: string) {
  const status = success ? '✓' : '✗';
  write(`[${timestamp()}] AGENT ACTION ${status} — Match: ${matchId}
  Agent:  ${agentId}
  Action: ${action}
  ${detail ? `Detail: ${detail}` : ''}
════════════════════════════════════════════════════════════`);
}

export function logAgentError(matchId: string, agentId: string, error: string) {
  write(`[${timestamp()}] AGENT ERROR — Match: ${matchId}
  Agent: ${agentId}
  Error: ${error}
════════════════════════════════════════════════════════════`);
}
