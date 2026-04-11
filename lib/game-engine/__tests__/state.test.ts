import { describe, it, expect } from 'vitest';
import { initializeGame, applyTurn, getPlayerView } from '../state';

const SEED = 'test-seed-deterministic';

describe('initializeGame', () => {
  it('creates a valid game state', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    expect(state.status).toBe('active');
    expect(state.winner).toBeNull();
    expect(state.turnCount).toBe(0);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('deals 6 cards to each player', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    expect(state.hands.p1.length).toBe(6);
    expect(state.hands.p2.length).toBe(6);
  });

  it('places one card on the discard pile', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    expect(state.discardPile.length).toBe(1);
  });

  it('starter card is not a special card', () => {
    // Test with multiple seeds to increase confidence
    for (const seed of ['seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5']) {
      const state = initializeGame('match', ['p1', 'p2'], seed);
      const starter = state.discardPile[0];
      expect([1, 2, 5, 8, 14, 20]).not.toContain(starter.number);
    }
  });

  it('remaining deck has correct card count', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const totalCards =
      state.deck.length +
      state.discardPile.length +
      state.hands.p1.length +
      state.hands.p2.length;
    expect(totalCards).toBe(54);
  });

  it('throws for non-2-player games', () => {
    expect(() => initializeGame('m', ['p1'], SEED)).toThrow();
    expect(() => initializeGame('m', ['p1', 'p2', 'p3'], SEED)).toThrow();
  });
});

describe('applyTurn', () => {
  it('rejects actions from wrong player', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    expect(() => applyTurn(state, 'p2', { type: 'draw' })).toThrow('Not your turn');
  });

  it('allows drawing a card', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const next = applyTurn(state, 'p1', { type: 'draw' });
    expect(next.hands.p1.length).toBe(7); // 6 + 1 drawn
    expect(next.turnCount).toBe(1);
    expect(next.currentPlayerIndex).toBe(1); // p2's turn
  });

  it('allows playing a valid card', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const topCard = state.discardPile[0];

    // Find a playable card in p1's hand
    const playable = state.hands.p1.find(
      (c) =>
        c.shape === topCard.shape ||
        c.number === topCard.number ||
        c.shape === 'whot'
    );

    if (playable) {
      const chosenShape = playable.shape === 'whot' ? 'circle' : undefined;
      const next = applyTurn(state, 'p1', {
        type: 'play',
        cardId: playable.id,
        chosenShape,
      });
      expect(next.hands.p1.length).toBe(5);
      expect(next.discardPile.length).toBe(2);
      expect(next.discardPile[1].id).toBe(playable.id);
    } else {
      // If no playable card, drawing should work
      const next = applyTurn(state, 'p1', { type: 'draw' });
      expect(next.hands.p1.length).toBe(7);
    }
  });

  it('rejects playing a card not in hand', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    expect(() =>
      applyTurn(state, 'p1', { type: 'play', cardId: 9999 })
    ).toThrow('Card not in hand');
  });

  it('rejects playing an invalid card', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const topCard = state.discardPile[0];

    // Find a card that doesn't match
    const unplayable = state.hands.p1.find(
      (c) =>
        c.shape !== topCard.shape &&
        c.number !== topCard.number &&
        c.shape !== 'whot'
    );

    if (unplayable) {
      expect(() =>
        applyTurn(state, 'p1', { type: 'play', cardId: unplayable.id })
      ).toThrow('Invalid play');
    }
  });

  it('does not allow actions on a finished game', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    state.status = 'finished';
    expect(() => applyTurn(state, 'p1', { type: 'draw' })).toThrow(
      'Game is not active'
    );
  });
});

describe('applyTurn — special cards', () => {
  function makeState(overrides: Partial<ReturnType<typeof initializeGame>>) {
    const base = initializeGame('match-1', ['p1', 'p2'], SEED);
    return { ...base, ...overrides };
  }

  it('Pick Two stacks pending draws', () => {
    const state = makeState({
      hands: {
        p1: [{ id: 100, shape: 'circle', number: 2 }],
        p2: [
          { id: 200, shape: 'triangle', number: 2 },
          { id: 201, shape: 'cross', number: 7 },
        ],
      },
      discardPile: [{ id: 50, shape: 'triangle', number: 3 }],
      currentPlayerIndex: 0,
    });

    // p1 plays Pick Two (matches by number with another 2 that might be there, or by...
    // Actually let's set up so it can be played)
    const state2 = makeState({
      hands: {
        p1: [
          { id: 100, shape: 'circle', number: 2 },
          { id: 101, shape: 'circle', number: 3 },
          { id: 102, shape: 'circle', number: 10 },
        ],
        p2: [
          { id: 200, shape: 'triangle', number: 2 },
          { id: 201, shape: 'cross', number: 7 },
          { id: 202, shape: 'square', number: 10 },
        ],
      },
      discardPile: [{ id: 50, shape: 'circle', number: 7 }],
      currentPlayerIndex: 0,
    });

    const next = applyTurn(state2, 'p1', { type: 'play', cardId: 100 });
    expect(next.pendingDraws).toBe(2);
    expect(next.pendingDrawType).toBe(2);
  });

  it('pending draws resolved when opponent draws', () => {
    const state = makeState({
      hands: {
        p1: [
          { id: 100, shape: 'circle', number: 3 },
        ],
        p2: [
          { id: 201, shape: 'cross', number: 7 },
          { id: 202, shape: 'square', number: 10 },
        ],
      },
      discardPile: [{ id: 50, shape: 'circle', number: 2 }],
      pendingDraws: 2,
      pendingDrawType: 2,
      currentPlayerIndex: 1,
      deck: [
        { id: 300, shape: 'triangle', number: 3 },
        { id: 301, shape: 'star', number: 4 },
        { id: 302, shape: 'circle', number: 11 },
      ],
    });

    const next = applyTurn(state, 'p2', { type: 'draw' });
    expect(next.hands.p2.length).toBe(4); // 2 original + 2 drawn
    expect(next.pendingDraws).toBe(0);
    expect(next.pendingDrawType).toBeNull();
  });
});

describe('applyTurn — Last Card declaration', () => {
  function makeState() {
    const base = initializeGame('match-1', ['p1', 'p2'], SEED);
    return {
      ...base,
      hands: {
        p1: [
          { id: 100, shape: 'circle' as const, number: 3 },
          { id: 101, shape: 'circle' as const, number: 7 },
        ],
        p2: [
          { id: 200, shape: 'triangle' as const, number: 5 },
          { id: 201, shape: 'cross' as const, number: 10 },
          { id: 202, shape: 'square' as const, number: 11 },
        ],
      },
      discardPile: [{ id: 50, shape: 'circle' as const, number: 10 }],
      currentPlayerIndex: 0,
    };
  }

  it('allows declaring Last Card with 2 cards', () => {
    const state = makeState();
    const next = applyTurn(state, 'p1', { type: 'declare_last_card' });
    expect(next.lastCardDeclared.p1).toBe(true);
  });

  it('penalizes playing without declaring Last Card', () => {
    const state = makeState();
    // p1 has 2 cards, hasn't declared, tries to play
    const next = applyTurn(state, 'p1', { type: 'play', cardId: 100 });
    // Should draw penalty cards instead
    expect(next.hands.p1.length).toBeGreaterThan(2);
  });

  it('allows playing after declaring Last Card', () => {
    const state = makeState();
    const declared = applyTurn(state, 'p1', { type: 'declare_last_card' });
    const played = applyTurn(declared, 'p1', { type: 'play', cardId: 100 });
    expect(played.hands.p1.length).toBe(1);
  });
});

describe('applyTurn — win condition', () => {
  it('detects win when hand is emptied', () => {
    const base = initializeGame('match-1', ['p1', 'p2'], SEED);
    const state = {
      ...base,
      hands: {
        p1: [{ id: 100, shape: 'circle' as const, number: 3 }],
        p2: [
          { id: 200, shape: 'triangle' as const, number: 5 },
          { id: 201, shape: 'cross' as const, number: 10 },
        ],
      },
      discardPile: [{ id: 50, shape: 'circle' as const, number: 10 }],
      lastCardDeclared: { p1: true, p2: false },
      currentPlayerIndex: 0,
    };

    const next = applyTurn(state, 'p1', { type: 'play', cardId: 100 });
    expect(next.status).toBe('finished');
    expect(next.winner).toBe('p1');
  });
});

describe('getPlayerView', () => {
  it('hides opponent hand', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const view = getPlayerView(state, 'p1') as Record<string, unknown>;
    expect(view.myHand).toEqual(state.hands.p1);
    expect(view.opponentCardCount).toBe(6);
    expect(view).not.toHaveProperty('opponentHand');
  });

  it('shows correct turn info', () => {
    const state = initializeGame('match-1', ['p1', 'p2'], SEED);
    const view = getPlayerView(state, 'p1') as Record<string, unknown>;
    expect(view.isMyTurn).toBe(true);

    const view2 = getPlayerView(state, 'p2') as Record<string, unknown>;
    expect(view2.isMyTurn).toBe(false);
  });
});
