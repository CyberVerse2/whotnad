export type Shape = 'circle' | 'triangle' | 'cross' | 'square' | 'star';

export type CardShape = Shape | 'whot';

export interface Card {
  id: number;
  shape: CardShape;
  number: number;
}

export type PlayerAction =
  | { type: 'play'; cardId: number; chosenShape?: Shape }
  | { type: 'draw' };

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GameState {
  matchId: string;
  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  playerOrder: string[];
  currentPlayerIndex: number;
  activeShape: Shape | null; // set by Whot card
  pendingDraws: number; // stacked Pick Two/Three
  pendingDrawType: 2 | null; // which card caused pending draws
  turnCount: number;
  status: GameStatus;
  winner: string | null;
  log: GameLogEntry[];
}

export interface GameLogEntry {
  turn: number;
  playerId: string;
  action: PlayerAction;
  timestamp: number;
}

/**
 * Extended view for the AI agent — includes discard pile and turn log
 * that aren't sent to browser clients.
 */
export interface AgentGameView {
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
  // Agent-only fields
  discardPile: Card[];
  turnLog: GameLogEntry[];
  opponentId: string;
}

export interface MatchPoints {
  winnerId: string;
  loserId: string;
  winnerPoints: number;
  loserPoints: number;
  basePoints: number;
  dominanceBonus: number;
  speedBonus: number;
  streakMultiplier: number;
}
