/* eslint-disable no-unused-vars */
import redisClient from '../utils/redis.js';

const ACTIVITY_KEY = 'cb:activity';
const ACTIVITY_MAX = 50;

// Fallback in-memory stores (used when Redis is unavailable)
const _memActivityFeed = [];
const _memMatchSpectators = new Map();

export async function pushActivityEvent(text, type = 'info') {
  const entry = JSON.stringify({ text, type, timestamp: Date.now() });
  if (redisClient) {
    try {
      await redisClient.lPush(ACTIVITY_KEY, entry);
      await redisClient.lTrim(ACTIVITY_KEY, 0, ACTIVITY_MAX - 1);
      return;
    } catch (_) { /* fallthrough to memory */ }
  }
  _memActivityFeed.unshift({ text, type, timestamp: Date.now() });
  if (_memActivityFeed.length > ACTIVITY_MAX) _memActivityFeed.pop();
}

export async function getActivityFeed(limit = 10) {
  if (redisClient) {
    try {
      const raw = await redisClient.lRange(ACTIVITY_KEY, 0, limit - 1);
      return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    } catch (_) { /* fallthrough */ }
  }
  return _memActivityFeed.slice(0, limit);
}

function spectatorKey(matchId) { return `cb:spectators:${matchId}`; }

export async function getSpectatorCount(matchId) {
  if (redisClient) {
    try {
      return await redisClient.sCard(spectatorKey(matchId));
    } catch (_) { /* fallthrough */ }
  }
  return _memMatchSpectators.get(matchId)?.size || 0;
}
