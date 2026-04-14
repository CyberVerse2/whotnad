'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Shape } from '@/types/game';
import type { PlayerGameView, PointsSummary } from '@/types/messages';
import { soundWin, soundLose, soundError as soundErrorFx, soundMatchFound } from '@/lib/sounds';

export type GamePhase = 'idle' | 'queued' | 'matched' | 'playing' | 'finished';

const POLL_INTERVAL_QUEUE = 1500;
const POLL_INTERVAL_WAITING = 1500;

interface GameHookState {
  phase: GamePhase;
  gameState: PlayerGameView | null;
  matchId: string | null;
  winner: string | null;
  points: PointsSummary | null;
  error: string | null;
  lastAgentThinkMs: number | null;
  lastAgentThought: string | null;
  forfeiting: boolean;
}

interface GameStatePayload {
  view: PlayerGameView;
  points: PointsSummary | null;
  contractMatchId: string | null;
  resultTxHash: string | null;
  lastAgentThinkMs: number | null;
  lastAgentThought: string | null;
}

export function useGame(userId: string | null, initialMatchId?: string | null) {
  const [state, setState] = useState<GameHookState>({
    phase: initialMatchId ? 'playing' : 'idle',
    gameState: null,
    matchId: initialMatchId ?? null,
    winner: null,
    points: null,
    error: null,
    lastAgentThinkMs: null,
    lastAgentThought: null,
    forfeiting: false,
  });
  const connected = Boolean(userId);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchIdRef = useRef<string | null>(initialMatchId ?? null);

  useEffect(() => {
    matchIdRef.current = state.matchId;
  }, [state.matchId]);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (userId) {
      headers['Authorization'] = `Bearer ${userId}`;
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
  }, [userId]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const applyGameStatePayload = useCallback((data: GameStatePayload) => {
    if (data.view.status === 'finished') {
      setState((s) => ({
        ...s,
        phase: 'finished',
        gameState: data.view,
        winner: data.view.winner,
        points: data.points,
        lastAgentThinkMs: data.lastAgentThinkMs,
        lastAgentThought: data.lastAgentThought ?? null,
        forfeiting: false,
      }));
      stopPolling();
      if (data.view.winner === userId) {
        soundWin();
      } else {
        soundLose();
      }
      return data.view;
    }

    setState((s) => ({
      ...s,
      phase: 'playing',
      gameState: data.view,
      lastAgentThinkMs: data.lastAgentThinkMs,
      lastAgentThought: data.lastAgentThought ?? null,
      forfeiting: false,
      error: null,
    }));

    return data.view;
  }, [stopPolling, userId]);

  const fetchGameState = useCallback(async (): Promise<PlayerGameView | null> => {
    const matchId = matchIdRef.current;
    if (!userId || !matchId) return null;

    try {
      const res = await authFetch(`/api/game/state?matchId=${matchId}&userId=${userId}`);
      if (!res.ok) return null;

      const data = await res.json() as GameStatePayload;
      return applyGameStatePayload(data);
    } catch {
      return null;
    }
  }, [userId, authFetch, applyGameStatePayload]);

  const startWaitingPoll = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const view = await fetchGameState();
      if (view && (view.isMyTurn || view.status === 'finished')) {
        stopPolling();
      }
    }, POLL_INTERVAL_WAITING);
  }, [fetchGameState, stopPolling]);

  const pollQueue = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await authFetch(`/api/game/queue?userId=${userId}`);
      const data = await res.json();

      if (data.status === 'matched' && data.matchId) {
        soundMatchFound();
        setState((s) => ({
          ...s,
          phase: 'playing',
          matchId: data.matchId,
        }));
        stopPolling();
      }
    } catch {
      // ignore
    }
  }, [userId, authFetch, stopPolling]);

  useEffect(() => {
    stopPolling();

    if (state.phase === 'queued') {
      void pollQueue();
      pollingRef.current = setInterval(pollQueue, POLL_INTERVAL_QUEUE);
    } else if (state.phase === 'playing' && !state.gameState) {
      void fetchGameState().then((view) => {
        if (view && !view.isMyTurn && view.status === 'active') {
          startWaitingPoll();
        }
      });
    }

    return stopPolling;
  }, [state.phase, state.gameState === null, pollQueue, fetchGameState, startWaitingPoll, stopPolling]);

  const joinQueue = useCallback(async () => {
    if (!userId) {
      setState((s) => ({ ...s, error: 'Sign in before joining a match' }));
      return;
    }
    try {
      const res = await authFetch('/api/game/queue', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({
          ...s,
          error: typeof data?.error === 'string' ? data.error : 'Failed to join queue',
        }));
        return;
      }

      if (data.status === 'matched' && data.matchId) {
        setState((s) => ({
          ...s,
          phase: 'playing',
          matchId: data.matchId,
        }));
      } else {
        setState((s) => ({ ...s, phase: 'queued', error: null }));
      }
    } catch {
      setState((s) => ({ ...s, error: 'Failed to join queue' }));
    }
  }, [userId, authFetch]);

  const leaveQueue = useCallback(async () => {
    if (!userId) return;
    try {
      await authFetch('/api/game/queue', {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
      setState((s) => ({ ...s, phase: 'idle' }));
    } catch {
      // ignore
    }
  }, [userId, authFetch]);

  const performAction = useCallback(async (
    action: 'play' | 'draw' | 'declare_last_card',
    cardId?: number,
    chosenShape?: Shape
  ) => {
    if (!userId || !state.matchId) return;

    if (action === 'play' && cardId !== undefined && state.gameState) {
      const playedCard = state.gameState.myHand.find((c) => c.id === cardId);
      if (playedCard) {
        setState((s) => {
          if (!s.gameState) return s;
          return {
            ...s,
            gameState: {
              ...s.gameState,
              myHand: s.gameState.myHand.filter((c) => c.id !== cardId),
              topCard: playedCard,
              activeShape: chosenShape ?? null,
              isMyTurn: false,
              turnCount: s.gameState.turnCount + 1,
            },
          };
        });
      }
    }

    try {
      const res = await authFetch('/api/game/action', {
        method: 'POST',
        body: JSON.stringify({
          matchId: state.matchId,
          userId,
          action,
          cardId,
          chosenShape,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await fetchGameState();
        soundErrorFx();
        setState((s) => ({ ...s, error: data.error }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
        return;
      }

      const view = 'view' in data
        ? applyGameStatePayload(data as GameStatePayload)
        : await fetchGameState();

      if (view && !view.isMyTurn && view.status === 'active') {
        startWaitingPoll();
      }
    } catch {
      await fetchGameState();
      setState((s) => ({ ...s, error: 'Network error' }));
      setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
    }
  }, [userId, state.matchId, state.gameState, authFetch, applyGameStatePayload, fetchGameState, startWaitingPoll]);

  const playCard = useCallback(
    (cardId: number, chosenShape?: Shape) => performAction('play', cardId, chosenShape),
    [performAction]
  );

  const drawCard = useCallback(
    () => performAction('draw'),
    [performAction]
  );

  const declareLastCard = useCallback(
    () => performAction('declare_last_card'),
    [performAction]
  );

  const forfeit = useCallback(async () => {
    if (!userId || !state.matchId) return;
    setState((s) => ({ ...s, forfeiting: true, error: null }));
    try {
      const res = await authFetch('/api/game/forfeit', {
        method: 'POST',
        body: JSON.stringify({ matchId: state.matchId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({ ...s, forfeiting: false, error: data.error }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
        return;
      }

      if ('view' in data) {
        applyGameStatePayload(data as GameStatePayload);
        return;
      }

      const view = await fetchGameState();
      if (!view) {
        setState((s) => ({ ...s, forfeiting: false, error: 'Failed to update forfeited match' }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
      }
    } catch {
      setState((s) => ({ ...s, forfeiting: false, error: 'Failed to forfeit' }));
      setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
    }
  }, [userId, state.matchId, authFetch, applyGameStatePayload, fetchGameState]);

  const resetGame = useCallback(() => {
    stopPolling();
    setState({
      phase: 'idle',
      gameState: null,
      matchId: null,
      winner: null,
      points: null,
      error: null,
      lastAgentThinkMs: null,
      lastAgentThought: null,
      forfeiting: false,
    });
  }, [stopPolling]);

  return {
    ...state,
    connected,
    log: [],
    joinQueue,
    leaveQueue,
    playCard,
    drawCard,
    declareLastCard,
    forfeit,
    resetGame,
  };
}
