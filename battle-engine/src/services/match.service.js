// ─── Match Service ────────────────────────────────────────────────────────────
// All match business logic lives here. Controllers stay thin.

import { connectDB } from '../db.js';
import { MatchModel } from '../models/Match.js';
import redis from '../utils/redis.js';
import { generateId } from '../utils/helpers.js';

const MATCH_KEY = (id) => `match:${id}`;
const MATCH_TTL_SECONDS = 60 * 60 * 2; // 2 hours

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createMatch({ guestId, userId, displayName, roomType, language }) {
  await connectDB();

  const matchId = generateId('m-');
  const participant = {
    participantId: generateId('p-'),
    guestId: guestId ?? generateId('g-'),
    userId: userId ?? null,
    displayName: displayName ?? 'Anonymous',
    rating: 1200,
    wins: 0,
    losses: 0,
  };

  const match = await MatchModel.create({
    matchId,
    participants: [participant],
    players: [participant.participantId],
    roomType: roomType ?? 'CASUAL',
    status: 'WAITING',
  });

  // Cache minimal state in Redis
  const cachePayload = JSON.stringify({
    matchId,
    status: 'WAITING',
    language: language ?? 'javascript',
    participants: [participant],
    createdAt: Date.now(),
  });
  await redis.set(MATCH_KEY(matchId), cachePayload, { EX: MATCH_TTL_SECONDS });

  return match;
}

// ─── Get ──────────────────────────────────────────────────────────────────────
export async function getMatchById(matchId) {
  // Try Redis cache first
  const cached = await redis.get(MATCH_KEY(matchId));
  if (cached) return JSON.parse(cached);

  // Fall back to DB
  await connectDB();
  const match = await MatchModel.findOne({ matchId }).lean();
  if (!match) throw new Error('Match not found');

  // Re-populate cache
  await redis.set(MATCH_KEY(matchId), JSON.stringify(match), { EX: MATCH_TTL_SECONDS });
  return match;
}

// ─── Join ─────────────────────────────────────────────────────────────────────
export async function joinMatch(matchId, { guestId, userId, displayName }) {
  await connectDB();

  const match = await MatchModel.findOne({ matchId });
  if (!match) throw new Error('Match not found');
  if (match.status !== 'WAITING') throw new Error('Match is no longer open');
  if (match.participants.length >= 2) throw new Error('Match is already full');

  const participant = {
    participantId: generateId('p-'),
    guestId: guestId ?? generateId('g-'),
    userId: userId ?? null,
    displayName: displayName ?? 'Anonymous',
    rating: 1200,
    wins: 0,
    losses: 0,
  };

  match.participants.push(participant);
  match.players.push(participant.participantId);

  // Start the match when 2 players are in
  if (match.participants.length === 2) {
    match.status = 'RACING';
    match.startTime = Date.now();
  }

  await match.save();

  // Invalidate / update cache
  await redis.set(MATCH_KEY(matchId), JSON.stringify(match.toObject()), { EX: MATCH_TTL_SECONDS });
  return match;
}

// ─── Finish ───────────────────────────────────────────────────────────────────
export async function finishMatch(matchId, { winnerId }) {
  await connectDB();

  const match = await MatchModel.findOne({ matchId });
  if (!match) throw new Error('Match not found');
  if (match.status === 'FINISHED') throw new Error('Match already finished');

  match.status = 'FINISHED';
  match.winnerId = winnerId;
  match.endTime = Date.now();
  await match.save();

  await redis.set(MATCH_KEY(matchId), JSON.stringify(match.toObject()), { EX: MATCH_TTL_SECONDS });
  return match;
}

// ─── Orphan cleanup ───────────────────────────────────────────────────────────
export async function cleanupOrphanMatches() {
  await connectDB();
  const cutoff = new Date(Date.now() - 20 * 60 * 1000); // 20 min
  const result = await MatchModel.deleteMany({ status: 'WAITING', createdAt: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    console.log(`[match.service] Cleaned up ${result.deletedCount} orphan match(es)`);
  }
}
