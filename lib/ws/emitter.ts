import { EventEmitter } from 'events';
import type { PlayerGameView, PointsSummary } from '@/types/messages';

export interface GameStateEvent {
  matchId: string;
  // keyed by playerId
  views: Record<string, {
    view: PlayerGameView;
    points: PointsSummary | null;
    lastAgentThinkMs: number | null;
    lastAgentThought: string | null;
    lastAgentVoiceLine: number | null;
  }>;
}

export interface QueueMatchedEvent {
  matchId: string;
  playerIds: string[];
}

export interface GameErrorEvent {
  userId: string;
  message: string;
}

class GameEmitter extends EventEmitter {
  emitGameState(event: GameStateEvent) {
    this.emit('game:state', event);
  }

  emitQueueMatched(event: QueueMatchedEvent) {
    this.emit('queue:matched', event);
  }

  emitGameError(event: GameErrorEvent) {
    this.emit('game:error', event);
  }

  onGameState(handler: (event: GameStateEvent) => void) {
    this.on('game:state', handler);
  }

  onQueueMatched(handler: (event: QueueMatchedEvent) => void) {
    this.on('queue:matched', handler);
  }

  onGameError(handler: (event: GameErrorEvent) => void) {
    this.on('game:error', handler);
  }
}

// Singleton — shared across route handlers and WebSocket server
export const gameEmitter = new GameEmitter();
