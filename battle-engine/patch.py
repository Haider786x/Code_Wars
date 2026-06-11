import sys
with open('src/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'async function enforceRateLimit(req, res, profileName, keyParts = []) {',
    'export async function enforceRateLimit(req, res, profileName, keyParts = []) {'
)

old_disconnect = '''  socket.on('disconnect', () => {
    // Clean up spectating rooms on disconnect (fire-and-forget is fine here)
    for (const matchId of spectatingRooms) {
      removeSpectator(matchId, socket.id).catch(() => {});
      
      // Auto-delete empty waiting rooms when the last person disconnects
      io.in(matchRoom(matchId)).fetchSockets().then(async (sockets) => {
        if (sockets.length === 0) {
          await connectDB();
          await MatchModel.deleteOne({ matchId, status: 'WAITING' });
        }
      }).catch(() => {});
    }
    spectatingRooms.clear();
  });'''

new_disconnect = '''  socket.on('disconnecting', () => {
    // Clean up rooms the socket is in
    for (const room of socket.rooms) {
      if (room.startsWith('match:')) {
        const matchId = room.split(':')[1];
        if (spectatingRooms.has(matchId)) {
          removeSpectator(matchId, socket.id).catch(() => {});
        }
        
        // Auto-delete empty waiting rooms when the last person disconnects
        io.in(room).fetchSockets().then(async (sockets) => {
          if (sockets.length <= 1) { // 1 means only this socket is left, and it is disconnecting
            await connectDB();
            await MatchModel.deleteOne({ matchId, status: 'WAITING' });
          }
        }).catch(() => {});
      }
    }
  });

  socket.on('disconnect', () => {
    spectatingRooms.clear();
  });'''

content = content.replace(old_disconnect, new_disconnect)

old_cleanup = "import { cleanupOrphanMatches } from './services/match.service.js';"
new_cleanup = """async function cleanupOrphanMatches() {
  try {
    const expired = Date.now() - 3600000;
    const result = await MatchModel.deleteMany({ status: 'WAITING', createdAt: { $lt: new Date(expired) } });
    if (result.deletedCount > 0) {
      console.log(\"[Cleanup] Removed \" + result.deletedCount + \" orphan WAITING matches\");
    }
  } catch (error) {
    console.error('[Cleanup] Error removing orphan matches:', error);
  }
}"""

content = content.replace(old_cleanup, new_cleanup)

with open('src/server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
