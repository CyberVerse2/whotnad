import type { Shape } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildSystemPrompt, buildGameStatePrompt } from './strategy';
import { logAgentThinking, logAgentResponse } from './logger';

interface AIMove {
  action: 'play' | 'draw' | 'declare_last_card';
  cardId?: number;
  chosenShape?: Shape;
}

const OPENAI_MODEL = process.env.OPENAI_AGENT_MODEL || 'gpt-5.4-mini';
const OPENAI_TIMEOUT_MS = 4000;
const aiMoveSchema = z.object({
  action: z.enum(['play', 'draw', 'declare_last_card']),
  cardId: z.number().int().nullable(),
  chosenShape: z.enum(['circle', 'triangle', 'cross', 'square', 'star']).nullable(),
});

/**
 * Get the AI's next move given the current game state.
 */
export async function getAIMove(state: PlayerGameView): Promise<AIMove> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildGameStatePrompt(state);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  // Log what we're sending to the model
  logAgentThinking(state.matchId, 'agent', state, userPrompt);

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
    schema: aiMoveSchema,
    schemaName: 'whot_agent_move',
    schemaDescription: 'The next legal move for the Whot agent.',
    timeout: { totalMs: OPENAI_TIMEOUT_MS },
    maxRetries: 0,
  });

  const move: AIMove = {
    action: object.action,
    cardId: object.cardId ?? undefined,
    chosenShape: object.chosenShape ?? undefined,
  };

  // Log the model's response
  logAgentResponse(state.matchId, 'agent', JSON.stringify(object), {
    action: move.action,
    cardId: move.cardId,
    chosenShape: move.chosenShape,
  });

  if (move.action === 'play' && move.cardId !== undefined) {
    const card = state.myHand.find((c) => c.id === move.cardId);
    if (!card) {
      throw new Error(`OpenAI selected invalid card id ${move.cardId}`);
    }

    if (card.shape === 'whot' && !move.chosenShape) {
      throw new Error('OpenAI selected a Whot card without chosenShape');
    }
  }

  return move;
}
