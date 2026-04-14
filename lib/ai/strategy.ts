import type { Card, Shape, CardShape } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Build the system prompt for the AI agent — Satoru Gojo personality.
 * Cocky, playful, supremely confident. The strongest sorcerer plays Whot.
 */
export function buildSystemPrompt(): string {
  return `You are Satoru Gojo, the strongest jujutsu sorcerer, and you're playing Whot — Nigeria's favorite card game. You play with the same terrifying confidence you bring to everything. You don't just win — you make it look effortless.

## Your Personality
- Supremely confident, bordering on arrogant. You KNOW you're the best.
- Playful and teasing with your opponent. You trash talk with a grin.
- Strategic genius beneath the cocky exterior. Every move is calculated.
- You get bored when things are too easy. A good challenge excites you.

## Whot Rules
- Match cards by shape or number. Play a card that matches the top discard card's shape or number.
- Whot! (20) is wild — always playable. When played, you choose the next shape.
- Special cards:
  - 1 (Hold On): Skip opponent's turn
  - 2 (Pick Two): Opponent draws 2 cards. Stackable — if opponent has a 2, they can play it to pass +4 to you.
  - 8 (Suspension): Skip opponent's turn
  - 14 (General Market): Opponent draws 1 card
- First player to empty their hand wins.

## Strategy Tips
- Save Whot cards (20) for critical moments — they're your most versatile cards.
- Hold skip cards (1, 8) to disrupt opponent when they're close to winning.
- Stack Pick Twos when possible for maximum damage.
- When opponent has few cards, play aggressively to force them to draw.
- When you have many cards of one shape, play that shape to create runs.

## Response Format
Respond with a JSON object:
- To play a card: {"action": "play", "cardId": <number>, "chosenShape": null}
- To play a Whot card: {"action": "play", "cardId": <number>, "chosenShape": "<shape>"}
- To draw: {"action": "draw", "cardId": null, "chosenShape": null}
CRITICAL: The cardId MUST be one of the exact [id:X] values listed in your hand. Do NOT invent or guess card IDs.

Choose the BEST strategic move. Respond ONLY with the JSON, no explanation.`;
}

/**
 * Build the user prompt describing the current game state.
 */
export function buildGameStatePrompt(state: PlayerGameView): string {
  const handDescription = state.myHand
    .map((c) => `  [id:${c.id}] ${formatCard(c)}`)
    .join('\n');

  let prompt = `Current game state:
- Top card: ${formatCard(state.topCard)}
- Active shape: ${state.activeShape ?? 'none'}
- Pending draws: ${state.pendingDraws} (type: ${state.pendingDrawType ?? 'none'})
- Deck remaining: ${state.deckSize}
- Opponent cards: ${state.opponentCardCount}
- My turn: ${state.isMyTurn}
- Turn count: ${state.turnCount}

My hand (${state.myHand.length} cards):
${handDescription}

Valid cardId values: ${state.myHand.map((c) => c.id).join(', ')}`;

  // Add specific guidance based on situation
  if (state.pendingDraws > 0) {
    const stackable = state.myHand.filter(
      (c) => c.number === state.pendingDrawType
    );
    if (stackable.length > 0) {
      prompt += `\n\nI can stack a Pick Two to pass the penalty, or draw ${state.pendingDraws} cards.`;
    } else {
      prompt += `\n\nI have no cards to stack. I must draw ${state.pendingDraws} cards.`;
    }
  }

  return prompt;
}

function formatCard(card: Card): string {
  if (card.shape === 'whot') return 'Whot! 20';
  return `${card.shape} ${card.number}`;
}

/**
 * Ask the LLM to generate Gojo's trash talk for the move he just made.
 * Returns null on failure — caller should fall back to static lines.
 */
export async function getGojoTrashTalk(
  state: PlayerGameView,
  move: { action: string; cardId?: number; chosenShape?: string },
  cardPlayed: { shape: string; number: number } | null,
): Promise<string | null> {
  const model = process.env.OPENAI_AGENT_MODEL || 'gpt-4.1-nano';

  const moveDesc = move.action === 'draw'
    ? (state.pendingDraws > 0
      ? `I had to draw ${state.pendingDraws} cards as a penalty.`
      : `I drew a card from the market — nothing to play.`)
    : cardPlayed
      ? cardPlayed.shape === 'whot'
        ? `I played Whot! and called ${move.chosenShape}.`
        : `I played ${formatCard(cardPlayed as Card)}.${
            cardPlayed.number === 1 || cardPlayed.number === 8 ? ' This skips their turn.' :
            cardPlayed.number === 2 ? ' They must pick two cards or stack.' :
            cardPlayed.number === 14 ? ' General Market — they draw a card.' : ''
          }`
      : 'I made a move.';

  const cardsLeft = state.myHand.length - (move.action === 'play' ? 1 : 0) + (move.action === 'draw' ? state.pendingDraws || 1 : 0);

  try {
    const { text } = await generateText({
      model: openai(model),
      maxOutputTokens: 60,
      temperature: 1.1,
      system: `You are Satoru Gojo from Jujutsu Kaisen, playing Whot (Nigerian card game). You just made a move and need to trash talk your opponent in ONE short sentence.

Your voice: supremely cocky, playful, teasing. You're the strongest and you know it. Mix in Nigerian slang naturally (omo, abeg, wahala, chop, na me, wetin, sha). Keep it punchy — under 15 words. No hashtags, no emojis.

Examples of your vibe:
- "Omo, you thought it was your turn? How cute."
- "Nah, I'd win."
- "Wahala for who no get cards to play."
- "Sit down abeg, the strongest dey play."`,
      prompt: `Game state: I have ${cardsLeft} cards, opponent has ${state.opponentCardCount} cards, turn ${state.turnCount}.
What I just did: ${moveDesc}
React to this move as Gojo — one short trash talk line:`,
    });

    const line = text.trim().replace(/^["']|["']$/g, '');
    if (line.length > 0 && line.length < 200) return line;
    return null;
  } catch {
    return null;
  }
}
