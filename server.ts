import 'dotenv/config';
import { createServer } from 'http';
import next from 'next';
import { initWebSocketServer, handleUpgrade, shutdownWebSocketServer } from './lib/ws/server';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';

const httpServer = createServer();

const app = next({ dev, httpServer, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Handle normal HTTP requests via Next.js
  httpServer.on('request', (req, res) => {
    handle(req, res);
  });

  // Initialize our game WebSocket server (noServer mode)
  initWebSocketServer();

  // Route WebSocket upgrade requests — only handle /ws, let Next.js handle HMR
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname === '/ws') {
      handleUpgrade(req, socket, head);
    }
    // Non-/ws upgrades (like /_next/webpack-hmr) are handled by Next.js internally
  });

  httpServer.listen(port, () => {
    console.log(
      `> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV}`
    );
    console.log(`> WebSocket available at ws://localhost:${port}/ws`);
  });

  // Graceful shutdown
  const shutdown = () => {
    shutdownWebSocketServer();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
