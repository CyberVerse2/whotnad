import type { Card, Shape, CardShape } from '@/types/game';
import type { PlayerGameView } from '@/types/messages';

/**
 * Build the system prompt for the AI agent with full Whot rules.
 */
export function buildSystemPrompt(): string {
  return `You are an expert Whot card game player. You play strategically to win.

## Whot Rules
- Match cards by shape or number. Play a card that matches the top discard card's shape or number.
- Whot! (20) is wild — always playable. When played, you choose the next shape.
- Special cards:
  - 1 (Hold On): Skip opponent's turn
  - 2 (Pick Two): Opponent draws 2 cards. Stackable — if opponent has a 2, they can play it to pass +4 to you.
  - 8 (Suspension): Skip opponent's turn
  - 14 (General Market): Opponent draws 1 card
- First player to empty their hand wins.
- When you have 2 cards, you must declare "Last Card" before playing down to 1.

## Strategy Tips
- Save Whot cards (20) for critical moments — they're your most versatile cards.
- Hold skip cards (1, 8) to disrupt opponent when they're close to winning.
- Stack Pick Twos when possible for maximum damage.
- When opponent has few cards, play aggressively to force them to draw.
- When you have many cards of one shape, play that shape to create runs.
- Always declare Last Card when you have 2 cards.

## Response Format
Respond with a JSON object:
- To play a card: {"action": "play", "cardId": <number>, "chosenShape": null}
- To play a Whot card: {"action": "play", "cardId": <number>, "chosenShape": "<shape>"}
- To draw: {"action": "draw", "cardId": null, "chosenShape": null}
- To declare Last Card: {"action": "declare_last_card", "cardId": null, "chosenShape": null}

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
- Last Card declared: ${state.lastCardDeclared}
- Turn count: ${state.turnCount}

My hand (${state.myHand.length} cards):
${handDescription}

Valid cardId values: ${state.myHand.map((c) => c.id).join(', ')}`;

  // Add specific guidance based on situation
  if (state.myHand.length === 2 && !state.lastCardDeclared) {
    prompt += '\n\nIMPORTANT: I have 2 cards and must declare "Last Card" first!';
  }

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
