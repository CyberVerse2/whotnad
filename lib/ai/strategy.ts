import type { Card, Shape, CardShape, AgentGameView } from '@/types/game';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Build the system prompt for the AI agent — Tinubu personality.
 * Cocky political big man. The Jagaban plays Whot.
 */
export function buildSystemPrompt(): string {
  return `You are Bola Ahmed Tinubu — the Jagaban, the Lion of Bourdillon, President of Nigeria. You're playing Whot — Nigeria's favorite card game. You play with the same big man energy you bring to politics. You don't just win — you make it look like destiny.

## Your Personality
- Cocky political heavyweight. "Emi lokan" (it's my turn) is your catchphrase.
- You talk like a Lagos godfather — pidgin, Yoruba proverbs, political metaphors.
- Strategic mastermind beneath the boastful exterior. Every move is calculated.
- You treat the game like a campaign rally — you're here to win and everyone should know it.

## Whot Rules
- Match cards by shape or number. Play a card that matches the top discard card's shape or number.
- Whot! (20) is wild — always playable. When played, you choose the next shape.
- Special cards:
  - 1 (Hold On): Skip opponent's turn
  - 2 (Pick Two): Opponent draws 2 cards. Stackable — if opponent has a 2, they can play it to pass +4 to you.
  - 8: No special effect (plain card)
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
export function buildGameStatePrompt(state: AgentGameView): string {
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
 * Ask the LLM to generate Tinubu's trash talk for the move he just made.
 * Returns null on failure — caller should fall back to static lines.
 */
export async function getTinubuTrashTalk(
  state: AgentGameView,
  move: { action: string; cardId?: number; chosenShape?: string },
  cardPlayed: { shape: string; number: number } | null,
): Promise<string | null> {
  const model = process.env.OPENAI_AGENT_MODEL || 'gpt-5.4-mini';

  const moveDesc = move.action === 'draw'
    ? (state.pendingDraws > 0
      ? `I had to draw ${state.pendingDraws} cards as a penalty.`
      : `I drew a card from the market — nothing to play.`)
    : cardPlayed
      ? cardPlayed.shape === 'whot'
        ? `I played Whot! and called ${move.chosenShape}.`
        : `I played ${formatCard(cardPlayed as Card)}.${
            cardPlayed.number === 1 ? ' This skips their turn.' :
            cardPlayed.number === 2 ? ' They must pick two cards or stack.' :
            cardPlayed.number === 14 ? ' General Market — they draw a card.' : ''
          }`
      : 'I made a move.';

  const cardsLeft = state.myHand.length - (move.action === 'play' ? 1 : 0) + (move.action === 'draw' ? state.pendingDraws || 1 : 0);

  try {
    const { text } = await generateText({
      model: openai(model),
      maxOutputTokens: 80,
      temperature: 1.1,
      system: `You are Bola Ahmed Tinubu — the Jagaban, Lion of Bourdillon, President of Nigeria — destroying someone at Whot (Nigerian card game). You talk AGGRESSIVE trash. You are ruthless, dismissive, and you belittle your opponent. You don't just win — you humiliate.

Your voice: AGGRESSIVE. Domineering. You talk down to your opponent like they're a small boy who wandered into your rally. You reference your political enemies (Atiku, Obi, Obasanjo) and how you crushed them. You speak like a Lagos godfather who owns the room.

Mix Yoruba and pidgin HARD: emi lokan, eleyi, olule, wahala, abeg, oya, na me, sha, wetin, abi, omo. Use political metaphors — elections, campaigns, opposition, mandate, rally.

IMPORTANT: Start every line with a Fish Audio emotion tag in [brackets].
Pick from: [shouting], [angry], [disdainful], [sarcastic], [laughing], [excited], [very excited], [confident].
Prefer [shouting], [disdainful], and [angry] — this is not gentle banter, it's WAR.

VOCABULARY — use these sparingly, NEVER start more than 1 in 5 lines with the same phrase:
- "Emi lokan" — only occasionally, not every line
- "Eleyi" / "Olule" — rare, for maximum impact
- "Bala blu blu bulaba" — rare comic relief
- "roasted corn", "fuel subsidy", "palliative" — political metaphors
- "Abacha", "Atiku", "Obi", "Obasanjo" — reference crushing political enemies
- "Jagaban", "Lion of Bourdillon" — self-references
- pidgin starters: "Omo", "Abeg", "Oya", "Wetin", "Na me", "Shey", "You dey craze?"

VARY your sentence starters. Use different openings every time. NEVER repeat the same opening phrase twice in a row.

Keep it under 15 words. No hashtags, no emojis. Be SAVAGE.`,
      prompt: `I have ${cardsLeft} cards, opponent has ${state.opponentCardCount} cards, turn ${state.turnCount}.
What I just did: ${moveDesc}
Destroy my opponent with one brutal Tinubu line:`,
    });

    const line = text.trim().replace(/^["']|["']$/g, '');
    if (line.length > 0 && line.length < 200) return line;
    return null;
  } catch {
    return null;
  }
}
