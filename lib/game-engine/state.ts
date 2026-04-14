import type { Card, GameState, PlayerAction, Shape } from '@/types/game';
import { createDeck } from './cards';
import { shuffleDeck } from './shuffle';
import { isValidPlay, getPlayableCards } from './rules';
import { applyCardEffect, resolvePendingDraws } from './effects';

const INITIAL_HAND_SIZE = 6;

/**
 * Initialize a new game with the given players and Drand seed.
 * Shuffles deck, deals hands, places first card on discard pile.
 */
export function initializeGame(
  matchId: string,
  playerIds: string[],
  seed: string
): GameState {
  if (playerIds.length !== 2) {
    throw new Error('Whot requires exactly 2 players');
  }

  const deck = shuffleDeck(createDeck(), seed);
  const hands: Record<string, Card[]> = {};

  // Deal cards to each player
  for (const playerId of playerIds) {
    hands[playerId] = [];
  }

  let deckIndex = 0;
  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (const playerId of playerIds) {
      hands[playerId].push(deck[deckIndex++]);
    }
  }

  // Find first non-special card for the discard pile starter
  let starterIndex = deckIndex;
  while (starterIndex < deck.length) {
    const card = deck[starterIndex];
    if (![1, 2, 5, 8, 14, 20].includes(card.number)) break;
    starterIndex++;
  }

  // If all remaining cards are special, just use the next card
  if (starterIndex >= deck.length) {
    starterIndex = deckIndex;
  }

  const starterCard = deck[starterIndex];
  const remainingDeck = [
    ...deck.slice(deckIndex, starterIndex),
    ...deck.slice(starterIndex + 1),
  ];

  return {
    matchId,
    deck: remainingDeck,
    discardPile: [starterCard],
    hands,
    playerOrder: playerIds,
    currentPlayerIndex: 0,
    activeShape: null,
    pendingDraws: 0,
    pendingDrawType: null,
    turnCount: 0,
    status: 'active',
    winner: null,
    log: [],
  };
}

/**
 * Apply a player's action to the game state.
 * Returns the new state or throws if the action is invalid.
 */
export function applyTurn(
  state: GameState,
  playerId: string,
  action: PlayerAction
): GameState {
  if (state.status !== 'active') {
    throw new Error('Game is not active');
  }

  const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
  if (playerId !== currentPlayerId) {
    throw new Error('Not your turn');
  }

  const next = { ...state };
  next.log = [...state.log, { turn: state.turnCount, playerId, action, timestamp: Date.now() }];

  switch (action.type) {
    case 'play':
      return handlePlayCard(next, playerId, action.cardId, action.chosenShape);

    case 'draw':
      return handleDraw(next, playerId);

    default:
      throw new Error('Unknown action type');
  }
}

function handlePlayCard(
  state: GameState,
  playerId: string,
  cardId: number,
  chosenShape?: Shape
): GameState {
  const hand = state.hands[playerId];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error('Card not in hand');
  }

  const card = hand[cardIndex];
  const topCard = state.discardPile[state.discardPile.length - 1];

  if (!isValidPlay(topCard, card, state.activeShape, state.pendingDraws, state.pendingDrawType)) {
    throw new Error('Invalid play');
  }

  let next = { ...state };
  next.hands = { ...state.hands };
  next.hands[playerId] = hand.filter((_, i) => i !== cardIndex);
  next.discardPile = [...state.discardPile, card];
  next.turnCount = state.turnCount + 1;

  // Clear active shape unless playing another Whot
  if (card.number !== 20) {
    next.activeShape = null;
  }

  // Apply card effect if special
  if ([1, 2, 5, 8, 14, 20].includes(card.number)) {
    next = applyCardEffect(next, card, chosenShape);
  }

  // Check win condition
  if (next.hands[playerId].length === 0) {
    next.status = 'finished';
    next.winner = playerId;
    return next;
  }

  // Skip cards (1, 8, 14) let the current player go again — don't advance
  const skipsOpponent = card.number === 1 || card.number === 8 || card.number === 14;
  if (!skipsOpponent) {
    // Advance to next player
    next.currentPlayerIndex =
      (next.currentPlayerIndex + 1) % next.playerOrder.length;
  }

  return next;
}

function handleDraw(state: GameState, playerId: string): GameState {
  let next = { ...state };

  // If there are pending draws (Pick Two/Three), resolve them
  if (next.pendingDraws > 0) {
    next = resolvePendingDraws(next);
    next.turnCount = state.turnCount + 1;
    next.currentPlayerIndex =
      (next.currentPlayerIndex + 1) % next.playerOrder.length;
    return next;
  }

  // Normal draw: draw 1 card
  next.hands = { ...state.hands };
  next.hands[playerId] = [...state.hands[playerId]];
  next.deck = [...state.deck];

  if (next.deck.length === 0) {
    recycleDiscardPile(next);
  }

  if (next.deck.length > 0) {
    const drawnCard = next.deck.pop()!;
    next.hands[playerId].push(drawnCard);
  }

  next.turnCount = state.turnCount + 1;
  next.currentPlayerIndex =
    (next.currentPlayerIndex + 1) % next.playerOrder.length;

  return next;
}

function recycleDiscardPile(state: GameState): void {
  if (state.discardPile.length <= 1) return;
  const topCard = state.discardPile[state.discardPile.length - 1];
  const recycled = state.discardPile.slice(0, -1);
  state.deck = recycled;
  state.discardPile = [topCard];
}

/**
 * Get a sanitized view of the game state for a specific player.
 * Hides opponent's cards and the deck contents.
 */
export function getPlayerView(state: GameState, playerId: string): object {
  const opponentId = state.playerOrder.find((id) => id !== playerId)!;

  return {
    matchId: state.matchId,
    myHand: state.hands[playerId],
    opponentCardCount: state.hands[opponentId]?.length ?? 0,
    discardPile: state.discardPile,
    topCard: state.discardPile[state.discardPile.length - 1],
    deckSize: state.deck.length,
    activeShape: state.activeShape,
    pendingDraws: state.pendingDraws,
    pendingDrawType: state.pendingDrawType,
    currentPlayerId: state.playerOrder[state.currentPlayerIndex],
    isMyTurn: state.playerOrder[state.currentPlayerIndex] === playerId,
    turnCount: state.turnCount,
    status: state.status,
    winner: state.winner,
    log: state.log,
  };
}

export { INITIAL_HAND_SIZE };
