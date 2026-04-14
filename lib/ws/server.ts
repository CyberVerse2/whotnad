import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { gameEmitter, type GameStateEvent, type QueueMatchedEvent, type GameErrorEvent } from './emitter';
import type { ServerMessage } from '@/types/messages';

interface ClientSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  matchId?: string;
}

// userId → set of connected sockets (supports multiple tabs)
const userConnections = new Map<string, Set<ClientSocket>>();

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function initWebSocketServer() {
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: ClientSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing auth token');
      return;
    }

    ws.userId = token;
    ws.isAlive = true;

    // Register connection
    let conns = userConnections.get(token);
    if (!conns) {
      conns = new Set();
      userConnections.set(token, conns);
    }
    conns.add(ws);

    // Send connected confirmation
    sendToSocket(ws, { type: 'CONNECTED', userId: token });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      // Client can send subscribe messages to join a match room
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'SUBSCRIBE_MATCH' && typeof msg.matchId === 'string') {
          ws.matchId = msg.matchId;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      const conns = userConnections.get(token);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
          userConnections.delete(token);
        }
      }
    });
  });

  // Heartbeat every 30s
  heartbeatInterval = setInterval(() => {
    if (!wss) return;
    for (const ws of wss.clients as Set<ClientSocket>) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);

  // Listen to game events
  gameEmitter.onGameState(handleGameState);
  gameEmitter.onQueueMatched(handleQueueMatched);
  gameEmitter.onGameError(handleGameError);

  return wss;
}

export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  if (!wss) return;

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss!.emit('connection', ws, req);
  });
}

export function shutdownWebSocketServer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  userConnections.clear();
}

function handleGameState(event: GameStateEvent) {
  for (const [userId, payload] of Object.entries(event.views)) {
    const msg: ServerMessage = payload.view.status === 'finished'
      ? {
          type: 'GAME_OVER',
          state: payload.view,
          winner: payload.view.winner!,
          points: payload.points!,
          lastAgentThinkMs: payload.lastAgentThinkMs,
          lastAgentThought: payload.lastAgentThought,
        }
      : {
          type: 'GAME_STATE',
          state: payload.view,
          lastAgentThinkMs: payload.lastAgentThinkMs,
          lastAgentThought: payload.lastAgentThought,
        };
    sendToUser(userId, msg);
  }
}

function handleQueueMatched(event: QueueMatchedEvent) {
  for (const userId of event.playerIds) {
    sendToUser(userId, {
      type: 'MATCH_FOUND',
      matchId: event.matchId,
      opponentId: event.playerIds.find((id) => id !== userId) ?? '',
    });
  }
}

function handleGameError(event: GameErrorEvent) {
  sendToUser(event.userId, { type: 'ERROR', message: event.message });
}

function sendToUser(userId: string, msg: ServerMessage) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  for (const ws of conns) {
    sendToSocket(ws, msg);
  }
}

function sendToSocket(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
