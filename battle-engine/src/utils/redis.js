import { createClient } from 'redis';

let client;

if (process.env.REDIS_URL) {
  client = createClient({
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

  await client.connect().catch((err) => {
    console.error('[redis] Failed to connect:', err.message);
    process.exit(1);
  });
} else {
  console.warn('[redis] REDIS_URL is not set. Running in local mode without full Redis functionality.');
  client = {
    get: async () => null,
    set: async () => null,
    lPush: async () => null,
    lRange: async () => [],
    lTrim: async () => null,
    quit: async () => null,
  };
}

export default client;
