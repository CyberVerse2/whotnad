import type { Card, Shape, GameStatus } from './game';

// Client → Server messages
export type ClientMessage =
  | { type: 'JOIN_QUEUE' }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'PLAY_CARD'; cardId: number; chosenShape?: Shape }
  | { type: 'DRAW_CARD' }
  | { type: 'CHOOSE_SHAPE'; shape: Shape };

// Server → Client messages
export type ServerMessage =
  | { type: 'QUEUE_JOINED'; position: number }
  | { type: 'QUEUE_LEFT' }
  | { type: 'MATCH_FOUND'; matchId: string; opponentId: string }
  | { type: 'GAME_STATE'; state: PlayerGameView; lastAgentThinkMs?: number | null; lastAgentThought?: string | null; lastAgentVoiceLine?: number | null }
  | { type: 'TURN_RESULT'; state: PlayerGameView; lastAction: string; lastAgentThinkMs?: number | null; lastAgentThought?: string | null; lastAgentVoiceLine?: number | null }
  | { type: 'INVALID_MOVE'; reason: string }
  | { type: 'GAME_OVER'; state: PlayerGameView; winner: string; points: PointsSummary; lastAgentThinkMs?: number | null; lastAgentThought?: string | null; lastAgentVoiceLine?: number | null }
  | { type: 'OPPONENT_DISCONNECTED'; timeout: number }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'DEPOSIT_REQUIRED'; poolWalletAddress: string; amount: string }
  | { type: 'DEPOSIT_CONFIRMED'; playerId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'CONNECTED'; userId: string };

export interface PlayerGameView {
  matchId: string;
  myHand: Card[];
  opponentCardCount: number;
  topCard: Card;
  deckSize: number;
  activeShape: Shape | null;
  pendingDraws: number;
  pendingDrawType: 2 | null;
  currentPlayerId: string;
  isMyTurn: boolean;
  turnCount: number;
  status: GameStatus;
  winner: string | null;
  difficulty: 'hard' | 'nigerian';
}

export interface PointsSummary {
  winnerPoints: number;
  loserPoints: number;
  basePoints: number;
  dominanceBonus: number;
  speedBonus: number;
  streakMultiplier: number;
}
