'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { Shape } from '@/types/game';
import type { PlayerGameView, PointsSummary } from '@/types/messages';

export type GamePhase = 'idle' | 'queued' | 'matched' | 'playing' | 'finished';

const POLL_INTERVAL_QUEUE = 1500;
const POLL_INTERVAL_WAITING = 1500; // only poll when waiting for opponent

interface GameHookState {
  phase: GamePhase;
  gameState: PlayerGameView | null;
  matchId: string | null;
  contractMatchId: string | null;
  resultTxHash: string | null;
  winner: string | null;
  points: PointsSummary | null;
  error: string | null;
  lastAgentThinkMs: number | null;
}

interface DepositStatus {
  funded: boolean;
  refundable: boolean;
  player1: string;
  player2: string;
  status: number;
  fundedAt: number;
}

interface GameStatePayload {
  view: PlayerGameView;
  points: PointsSummary | null;
  contractMatchId: string | null;
  resultTxHash: string | null;
  lastAgentThinkMs: number | null;
}

export function useGame(userId: string | null, initialMatchId?: string | null) {
  const { getAccessToken } = usePrivy();

  const [state, setState] = useState<GameHookState>({
    phase: initialMatchId ? 'playing' : 'idle',
    gameState: null,
    matchId: initialMatchId ?? null,
    contractMatchId: null,
    resultTxHash: null,
    winner: null,
    points: null,
    error: null,
    lastAgentThinkMs: null,
  });
  const [depositStatus, setDepositStatus] = useState<DepositStatus | null>(null);
  const connected = Boolean(userId);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchIdRef = useRef<string | null>(initialMatchId ?? null);

  useEffect(() => {
    matchIdRef.current = state.matchId;
  }, [state.matchId]);

  // ── Authenticated fetch helper ──
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  // ── Stop polling ──
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ── Fetch game state once (no loop) ──
  const applyGameStatePayload = useCallback((data: GameStatePayload) => {
    if (data.view.status === 'finished') {
      setState((s) => ({
        ...s,
        phase: 'finished',
        gameState: data.view,
        winner: data.view.winner,
        points: data.points,
        contractMatchId: data.contractMatchId,
        resultTxHash: data.resultTxHash,
        lastAgentThinkMs: data.lastAgentThinkMs,
      }));
      stopPolling();
      return data.view;
    }

    setState((s) => ({
      ...s,
      phase: 'playing',
      gameState: data.view,
      contractMatchId: data.contractMatchId,
      resultTxHash: data.resultTxHash,
      lastAgentThinkMs: data.lastAgentThinkMs,
      error: null,
    }));

    return data.view;
  }, [stopPolling]);

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

  // ── Poll while waiting for opponent's turn ──
  const startWaitingPoll = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const view = await fetchGameState();
      // Stop polling once it's our turn again (or game ended)
      if (view && (view.isMyTurn || view.status === 'finished')) {
        stopPolling();
      }
    }, POLL_INTERVAL_WAITING);
  }, [fetchGameState, stopPolling]);

  // ── Poll queue status ──
  const pollQueue = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await authFetch(`/api/game/queue?userId=${userId}`);
      const data = await res.json();

      if (data.status === 'matched' && data.matchId) {
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

  const pollDepositStatus = useCallback(async (matchId: string) => {
    try {
      const res = await authFetch('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ matchId }),
      });
      if (!res.ok) return null;
      const data = await res.json() as DepositStatus;
      setDepositStatus(data);
      return data;
    } catch {
      return null;
    }
  }, [authFetch]);

  // ── Phase-based effects ──
  useEffect(() => {
    stopPolling();

    if (state.phase === 'queued') {
      void pollQueue();
      pollingRef.current = setInterval(pollQueue, POLL_INTERVAL_QUEUE);
    } else if (state.phase === 'playing' && !state.gameState) {
      // Initial load — fetch state once, then decide
      void fetchGameState().then((view) => {
        if (view && !view.isMyTurn && view.status === 'active') {
          startWaitingPoll();
        }
      });
    }

    return stopPolling;
  }, [state.phase, state.gameState === null, pollQueue, fetchGameState, startWaitingPoll, stopPolling]);

  // ── Actions ──

  const joinQueue = useCallback(async () => {
    if (!userId) {
      setState((s) => ({ ...s, error: 'Connect your wallet before joining a match' }));
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
          contractMatchId: data.contractMatchId ?? null,
        }));
        void pollDepositStatus(data.matchId);
      } else {
        setState((s) => ({ ...s, phase: 'queued', error: null }));
      }
    } catch {
      setState((s) => ({ ...s, error: 'Failed to join queue' }));
    }
  }, [userId, authFetch, pollDepositStatus]);

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

    // ── Optimistic update ──
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
    } else if (action === 'draw') {
      // No optimistic update for draw — we don't know which card(s) were drawn.
      // The server response via fetchGameState will provide the updated hand.
    }

    // ── Send to server ──
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
        // Revert: fetch real state
        await fetchGameState();
        setState((s) => ({ ...s, error: data.error }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
        return;
      }

      const view = 'view' in data
        ? applyGameStatePayload(data as GameStatePayload)
        : await fetchGameState();

      // If it's still not our turn (opponent is human, or agent hasn't played yet),
      // start polling until it is
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
    try {
      const res = await authFetch('/api/game/forfeit', {
        method: 'POST',
        body: JSON.stringify({ matchId: state.matchId }),
      });
      if (res.ok) {
        await fetchGameState();
      } else {
        const data = await res.json();
        setState((s) => ({ ...s, error: data.error }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
      }
    } catch {
      setState((s) => ({ ...s, error: 'Failed to forfeit' }));
      setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
    }
  }, [userId, state.matchId, authFetch, fetchGameState]);

  const resetGame = useCallback(() => {
    stopPolling();
    setState({
      phase: 'idle',
      gameState: null,
      matchId: null,
      contractMatchId: null,
      resultTxHash: null,
      winner: null,
      points: null,
      error: null,
      lastAgentThinkMs: null,
    });
    setDepositStatus(null);
  }, [stopPolling]);

  return {
    ...state,
    connected,
    log: [],
    depositStatus,
    refreshDepositStatus: () => state.matchId ? pollDepositStatus(state.matchId) : Promise.resolve(null),
    joinQueue,
    leaveQueue,
    playCard,
    drawCard,
    declareLastCard,
    forfeit,
    resetGame,
  };
}
