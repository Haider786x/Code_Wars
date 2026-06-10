// ─── Compulsory Redis Client ───────────────────────────────────────────────────
// Redis is REQUIRED. If REDIS_URL is not set the process will abort on startup.

import { createClient } from 'redis';

if (!process.env.REDIS_URL) {
  console.error('[redis] REDIS_URL is not set. Redis is required – aborting.');
  process.exit(1);
}

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '10000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS ?? '10000', 10),
  },
});

client.on('error', (err) => {
  console.error('[redis] Client error:', err.message);
});

client.on('connect', () => {
  console.log('[redis] Connected to Redis at', process.env.REDIS_URL?.split('@').pop());
});

// Connect immediately when this module is first imported.
await client.connect().catch((err) => {
  console.error('[redis] Failed to connect:', err.message);
  process.exit(1);
});

export default client;
