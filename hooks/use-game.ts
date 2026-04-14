'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Shape } from '@/types/game';
import type { PlayerGameView, PointsSummary, ServerMessage } from '@/types/messages';
import { soundWin, soundLose, soundError as soundErrorFx, soundMatchFound, playTinubuVoice } from '@/lib/sounds';
import { useGameSocket } from './use-game-socket';

export type GamePhase = 'idle' | 'queued' | 'matched' | 'playing' | 'finished';

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
  lastAgentVoiceLine: string | null;
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

  const lastSpokenThoughtRef = useRef<string | null>(null);

  const applyGameStatePayload = useCallback((data: GameStatePayload) => {
    // Play Tinubu's voice line if it's a new thought
    const thought = data.lastAgentThought ?? null;
    const voiceLine = data.lastAgentVoiceLine ?? null;
    if (thought && thought !== lastSpokenThoughtRef.current && voiceLine) {
      lastSpokenThoughtRef.current = thought;
      playTinubuVoice(Number(voiceLine));
    }

    if (data.view.status === 'finished') {
      setState((s) => ({
        ...s,
        phase: 'finished',
        gameState: data.view,
        winner: data.view.winner,
        points: data.points,
        lastAgentThinkMs: data.lastAgentThinkMs,
        lastAgentThought: thought,
        forfeiting: false,
      }));
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
      lastAgentThought: thought,
      forfeiting: false,
      error: null,
    }));

    return data.view;
  }, [userId]);

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

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'MATCH_FOUND':
        soundMatchFound();
        setState((s) => ({
          ...s,
          phase: 'playing',
          matchId: msg.matchId,
        }));
        break;

      case 'GAME_STATE': {
        const thought = msg.lastAgentThought ?? null;
        const voiceLine = msg.lastAgentVoiceLine ?? null;
        if (thought && thought !== lastSpokenThoughtRef.current && voiceLine) {
          lastSpokenThoughtRef.current = thought;
          playTinubuVoice(Number(voiceLine));
        }
        setState((s) => ({
          ...s,
          phase: 'playing',
          gameState: msg.state,
          lastAgentThinkMs: msg.lastAgentThinkMs ?? null,
          lastAgentThought: thought,
          error: null,
        }));
        break;
      }

      case 'GAME_OVER': {
        const thought = msg.lastAgentThought ?? null;
        const voiceLine = msg.lastAgentVoiceLine ?? null;
        if (thought && thought !== lastSpokenThoughtRef.current && voiceLine) {
          lastSpokenThoughtRef.current = thought;
          playTinubuVoice(Number(voiceLine));
        }
        setState((s) => ({
          ...s,
          phase: 'finished',
          gameState: msg.state,
          winner: msg.winner,
          points: msg.points,
          lastAgentThinkMs: msg.lastAgentThinkMs ?? null,
          lastAgentThought: thought,
          forfeiting: false,
        }));
        if (msg.winner === userId) {
          soundWin();
        } else {
          soundLose();
        }
        break;
      }

      case 'ERROR':
        setState((s) => ({ ...s, error: msg.message }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
        break;

      case 'INVALID_MOVE':
        soundErrorFx();
        setState((s) => ({ ...s, error: msg.reason }));
        setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
        break;
    }
  }, [userId]);

  const { isConnected } = useGameSocket(userId, { onMessage: handleWsMessage });

  // Fetch initial game state when entering playing phase (page load / reconnect)
  useEffect(() => {
    if (state.phase === 'playing' && !state.gameState) {
      void fetchGameState();
    }
  }, [state.phase, state.gameState === null, fetchGameState]);

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
    action: 'play' | 'draw',
    cardId?: number,
    chosenShape?: Shape
  ) => {
    if (!userId || !state.matchId) return;

    // Optimistic update for draw — immediately show it's opponent's turn
    if (action === 'draw' && state.gameState) {
      setState((s) => {
        if (!s.gameState) return s;
        return {
          ...s,
          gameState: {
            ...s.gameState,
            isMyTurn: false,
          },
        };
      });
    }

    // Optimistic update for card plays
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

      // Apply the REST response for immediate feedback
      if ('view' in data) {
        applyGameStatePayload(data as GameStatePayload);
      }
      // WebSocket will also push any subsequent state updates (e.g. agent turn)
    } catch {
      await fetchGameState();
      setState((s) => ({ ...s, error: 'Network error' }));
      setTimeout(() => setState((s) => ({ ...s, error: null })), 3000);
    }
  }, [userId, state.matchId, state.gameState, authFetch, applyGameStatePayload, fetchGameState]);

  const playCard = useCallback(
    (cardId: number, chosenShape?: Shape) => performAction('play', cardId, chosenShape),
    [performAction]
  );

  const drawCard = useCallback(
    () => performAction('draw'),
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
  }, []);

  return {
    ...state,
    connected: connected && isConnected,
    log: [],
    joinQueue,
    leaveQueue,
    playCard,
    drawCard,
    forfeit,
    resetGame,
  };
}
