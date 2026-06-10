// ─── Entry Point ──────────────────────────────────────────────────────────────
// Boots the HTTP server, attaches Socket.io, and starts periodic maintenance.

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { connectDB } from './db.js';
import { cleanupOrphanMatches } from './services/match.service.js';
import { readPositiveIntEnv, cleanString, validateMatchId } from './utils/helpers.js';

const PORT = readPositiveIntEnv('PORT', 3000);

// ── HTTP Server ───────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? true,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  const spectatingRooms = new Set();

  socket.on('match:join', async (payload) => {
    try {
      const matchId = validateMatchId(
        cleanString(typeof payload === 'string' ? payload : payload?.matchId)
      );
      socket.join(`match:${matchId}`);
      spectatingRooms.add(matchId);

      const spectatorCount = (await io.in(`match:${matchId}`).fetchSockets()).length;
      io.to(`match:${matchId}`).emit('match:update', {
        type: 'SPECTATOR_COUNT',
        matchId,
        count: spectatorCount,
        timestamp: Date.now(),
      });
    } catch (err) {
      socket.emit('match:update', { type: 'ERROR', error: err.message, timestamp: Date.now() });
    }
  });

  socket.on('match:leave', async (matchId) => {
    try {
      const id = validateMatchId(cleanString(matchId));
      socket.leave(`match:${id}`);
      spectatingRooms.delete(id);
    } catch (_) {}
  });

  socket.on('disconnect', () => {
    spectatingRooms.clear();
  });
});

// Expose io to the rest of the app if needed (e.g. from services)
export { io };

// ── Start ─────────────────────────────────────────────────────────────────────
await connectDB();
console.log('[db] Connected to MongoDB');

httpServer.listen(PORT, () => {
  console.log(`[server] CodeBattle engine listening on http://localhost:${PORT}`);
});

// ── Periodic orphan match cleanup (every 10 minutes) ─────────────────────────
setInterval(cleanupOrphanMatches, 10 * 60 * 1000);
