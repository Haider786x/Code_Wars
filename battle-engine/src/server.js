import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdapter } from '@socket.io/redis-adapter';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { connectDB } from './db.js';
import { AnalyticsModel } from './models/Analytics.js';
import { DailyChallengeModel } from './models/DailyChallenge.js';
import { MatchModel } from './models/Match.js';
import { MatchHistoryModel } from './models/MatchHistory.js';
import { PlayerModel } from './models/Player.js';
import { TournamentModel } from './models/Tournament.js';
import { UserModel, AVAILABLE_AVATARS } from './models/User.js';
import Question from './models/Question.js';
import { languages } from './utils/lang.js';

const Verdict = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  COMPILE_ERROR: 'Compilation Error',
  RUNTIME_ERROR: 'Runtime Error',
};

const app = express();
const httpServer = createServer(app);
httpServer.requestTimeout = readPositiveIntEnv('HTTP_REQUEST_TIMEOUT_MS', 30000);
httpServer.headersTimeout = readPositiveIntEnv('HTTP_HEADERS_TIMEOUT_MS', 35000);
httpServer.keepAliveTimeout = readPositiveIntEnv('HTTP_KEEP_ALIVE_TIMEOUT_MS', 5000);
const isProduction = process.env.NODE_ENV === 'production';
const allowInsecureProduction = readBooleanEnv('ALLOW_INSECURE_PRODUCTION', false);
const port = readPositiveIntEnv('PORT', 3000);
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : true;
const requestBodyLimit = process.env.JSON_BODY_LIMIT || '256kb';
const maxCodeBytes = readPositiveIntEnv('MAX_CODE_BYTES', 64 * 1024);
const maxAiCodeBytes = readPositiveIntEnv('MAX_AI_CODE_BYTES', 32 * 1024);
const maxMatchIdLength = readPositiveIntEnv('MAX_MATCH_ID_LENGTH', 64);
const maxPlayerIdLength = readPositiveIntEnv('MAX_PLAYER_ID_LENGTH', 64);
const maxGuestIdLength = readPositiveIntEnv('MAX_GUEST_ID_LENGTH', 64);
const maxDisplayNameLength = readPositiveIntEnv('MAX_DISPLAY_NAME_LENGTH', 40);
const maxProblemTitleLength = readPositiveIntEnv('MAX_PROBLEM_TITLE_LENGTH', 120);
const pistonApiUrl = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston/execute';
const pistonRequestTimeoutMs = readPositiveIntEnv('PISTON_REQUEST_TIMEOUT_MS', 15000);
const geminiRequestTimeoutMs = readPositiveIntEnv('GEMINI_REQUEST_TIMEOUT_MS', 20000);
const shutdownTimeoutMs = readPositiveIntEnv('SHUTDOWN_TIMEOUT_MS', 10000);
const redisUrl = process.env.REDIS_URL;
const requireRedis = readBooleanEnv('REQUIRE_REDIS', false);
const runWorkers = readBooleanEnv('RUN_WORKERS', true);
const redisConnectTimeoutMs = readPositiveIntEnv('REDIS_CONNECT_TIMEOUT_MS', 10000);
const redisCommandTimeoutMs = readPositiveIntEnv('REDIS_COMMAND_TIMEOUT_MS', 5000);
const bullMqPrefix = process.env.BULLMQ_PREFIX || 'codebattle';
const queueNames = {
  code: 'code',
  analysis: 'analysis',
  timers: 'timers',
};
const matchTimers = new Map();
// Fallback in-memory stores (used when Redis is unavailable)
const _memMatchSpectators = new Map();
const _memMatchLanguage = new Map();
const _memActivityFeed = [];
const jwtSecret = process.env.JWT_SECRET || 'codebattle-dev-secret-change-in-production';
/** Single IORedis client used for ephemeral shared state (spectators, language, activity). */
let stateRedis = null;

// ── Redis-backed helpers (fall back to in-memory when Redis is down) ──────────

const ACTIVITY_KEY = 'cb:activity';
const ACTIVITY_MAX = 50;

async function pushActivityEvent(text, type = 'info') {
  const entry = JSON.stringify({ text, type, timestamp: Date.now() });
  if (stateRedis) {
    try {
      await stateRedis.lpush(ACTIVITY_KEY, entry);
      await stateRedis.ltrim(ACTIVITY_KEY, 0, ACTIVITY_MAX - 1);
      return;
    } catch (_) { /* fallthrough to memory */ }
  }
  _memActivityFeed.unshift({ text, type, timestamp: Date.now() });
  if (_memActivityFeed.length > ACTIVITY_MAX) _memActivityFeed.pop();
}

async function getActivityFeed(limit = 10) {
  if (stateRedis) {
    try {
      const raw = await stateRedis.lrange(ACTIVITY_KEY, 0, limit - 1);
      return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    } catch (_) { /* fallthrough */ }
  }
  return _memActivityFeed.slice(0, limit);
}

function spectatorKey(matchId) { return `cb:spectators:${matchId}`; }

async function addSpectator(matchId, socketId) {
  if (stateRedis) {
    try {
      await stateRedis.sadd(spectatorKey(matchId), socketId);
      await stateRedis.expire(spectatorKey(matchId), 7200); // 2h TTL
      return await stateRedis.scard(spectatorKey(matchId));
    } catch (_) { /* fallthrough */ }
  }
  if (!_memMatchSpectators.has(matchId)) _memMatchSpectators.set(matchId, new Set());
  _memMatchSpectators.get(matchId).add(socketId);
  return _memMatchSpectators.get(matchId).size;
}

async function removeSpectator(matchId, socketId) {
  if (stateRedis) {
    try {
      await stateRedis.srem(spectatorKey(matchId), socketId);
      return await stateRedis.scard(spectatorKey(matchId));
    } catch (_) { /* fallthrough */ }
  }
  const set = _memMatchSpectators.get(matchId);
  if (set) { set.delete(socketId); if (set.size === 0) _memMatchSpectators.delete(matchId); }
  return set?.size || 0;
}

async function getSpectatorCount(matchId) {
  if (stateRedis) {
    try { return await stateRedis.scard(spectatorKey(matchId)); } catch (_) { /* fallthrough */ }
  }
  return _memMatchSpectators.get(matchId)?.size || 0;
}

function langKey(matchId) { return `cb:lang:${matchId}`; }

async function setMatchLanguage(matchId, language) {
  if (stateRedis) {
    try {
      await stateRedis.setex(langKey(matchId), 7200, language);
      return;
    } catch (_) { /* fallthrough */ }
  }
  _memMatchLanguage.set(matchId, language);
}

async function getMatchLanguage(matchId) {
  if (stateRedis) {
    try {
      const val = await stateRedis.get(langKey(matchId));
      if (val !== null) return val;
    } catch (_) { /* fallthrough */ }
  }
  return _memMatchLanguage.get(matchId) ?? null;
}

async function deleteMatchLanguage(matchId) {
  if (stateRedis) {
    try { await stateRedis.del(langKey(matchId)); } catch (_) { /* fallthrough */ }
  }
  _memMatchLanguage.delete(matchId);
}
const redisState = {
  enabled: Boolean(redisUrl),
  required: requireRedis,
  socketAdapter: false,
  queues: false,
  workers: false,
  rateLimiter: false,
  mode: redisUrl ? 'redis' : 'local',
  error: null,
};
const rateLimitProfiles = {
  matchRead: {
    max: readPositiveIntEnv('MATCH_READ_RATE_LIMIT_MAX', 240),
    windowMs: readPositiveIntEnv('MATCH_READ_RATE_LIMIT_WINDOW_MS', 60000),
  },
  matchWrite: {
    max: readPositiveIntEnv('MATCH_WRITE_RATE_LIMIT_MAX', 120),
    windowMs: readPositiveIntEnv('MATCH_WRITE_RATE_LIMIT_WINDOW_MS', 60000),
  },
  code: {
    max: readPositiveIntEnv('CODE_REQUEST_RATE_LIMIT_MAX', 30),
    windowMs: readPositiveIntEnv('CODE_REQUEST_RATE_LIMIT_WINDOW_MS', 60000),
  },
  ai: {
    max: readPositiveIntEnv('AI_REQUEST_RATE_LIMIT_MAX', 8),
    windowMs: readPositiveIntEnv('AI_REQUEST_RATE_LIMIT_WINDOW_MS', 60000),
  },
  socketJoin: {
    max: readPositiveIntEnv('SOCKET_JOIN_RATE_LIMIT_MAX', 120),
    windowMs: readPositiveIntEnv('SOCKET_JOIN_RATE_LIMIT_WINDOW_MS', 60000),
  },
  guestRoomCreate: {
    max: readPositiveIntEnv('GUEST_ROOM_CREATE_RATE_LIMIT_MAX', 20),
    windowMs: readPositiveIntEnv('GUEST_ROOM_CREATE_RATE_LIMIT_WINDOW_MS', 60000),
  },
  guestSubmission: {
    max: readPositiveIntEnv('GUEST_SUBMISSION_RATE_LIMIT_MAX', 30),
    windowMs: readPositiveIntEnv('GUEST_SUBMISSION_RATE_LIMIT_WINDOW_MS', 60000),
  },
  guestSocketEvent: {
    max: readPositiveIntEnv('GUEST_SOCKET_EVENT_RATE_LIMIT_MAX', 180),
    windowMs: readPositiveIntEnv('GUEST_SOCKET_EVENT_RATE_LIMIT_WINDOW_MS', 60000),
  },
};
let queues = null;
let rateLimitRedis = null;
let shuttingDown = false;
const workers = [];
const redisClients = [];
const localRateLimits = new Map();
const monitoringWebhookUrl = cleanString(process.env.MONITORING_WEBHOOK_URL);
const monitoringTimeoutMs = readPositiveIntEnv('MONITORING_TIMEOUT_MS', 2000);
const metricsState = {
  submissionCount: 0,
  matchCreationCount: 0,
  matchCompletionCount: 0,
  lastRedisLatencyMs: 0,
  redisLatencyChecks: 0,
  mongoQueryDurationMs: 0,
  mongoQueryCount: 0,
  queueProcessingLatencyMs: 0,
  queueProcessingCount: 0,
};

validateRuntimeConfig();
app.disable('x-powered-by');
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(requestContext);
app.use(securityHeaders);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: requestBodyLimit }));
app.use(jsonErrorHandler);

await setupRedisScaling();

io.on('connection', (socket) => {
  // Track which match rooms this socket is spectating
  const spectatingRooms = new Set();

  socket.on('match:join', async (payload) => {
    try {
      const activeMatchId = validateMatchId(cleanString(
        typeof payload === 'string' ? payload : payload?.matchId,
      ));
      const identity = getCurrentIdentity(payload || {}, { requireGuestId: false });
      const guestId = identity.type === 'guest' ? identity.guestId : null;

      const allowed = await enforceSocketRateLimit(socket, 'socketJoin', [activeMatchId]);
      if (!allowed) return;
      if (guestId) {
        const guestAllowed = await enforceSocketRateLimit(socket, 'guestSocketEvent', [guestId, activeMatchId]);
        if (!guestAllowed) return;
      }

      socket.join(matchRoom(activeMatchId));
      await emitCurrentMatchState(socket, activeMatchId);

      // Check if this socket is a spectator (not a player)
      await connectDB();
      const match = await MatchModel.findOne({ matchId: activeMatchId }).lean();
      const participantId = guestId || identity.userId;
      const isSpectator = match && !match.players.includes(participantId);

      if (isSpectator) {
        spectatingRooms.add(activeMatchId);
        const count = await addSpectator(activeMatchId, socket.id);
        io.to(matchRoom(activeMatchId)).emit('match:update', {
          type: 'SPECTATOR_COUNT',
          matchId: activeMatchId,
          count,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      await reportMonitoringEvent('socket_failure', error, {
        socketId: socket.id,
      });
      socket.emit('match:update', {
        type: 'ERROR',
        error: error.message || 'Could not join match stream',
        timestamp: Date.now(),
      });
      console.error('Failed to join match stream:', error);
    }
  });

  socket.on('match:leave', async (matchId) => {
    try {
      const activeMatchId = validateMatchId(cleanString(matchId));
      socket.leave(matchRoom(activeMatchId));
      // Clean up spectator tracking
      spectatingRooms.delete(activeMatchId);
      const count = await removeSpectator(activeMatchId, socket.id);
      io.to(matchRoom(activeMatchId)).emit('match:update', {
        type: 'SPECTATOR_COUNT',
        matchId: activeMatchId,
        count,
        timestamp: Date.now(),
      });
    } catch (_error) {
      // Ignore invalid leave requests.
    }
  });

  socket.on('disconnect', () => {
    // Clean up spectating rooms on disconnect (fire-and-forget is fine here)
    for (const matchId of spectatingRooms) {
      removeSpectator(matchId, socket.id).catch(() => {});
    }
    spectatingRooms.clear();
  });

  socket.on('error', async (error) => {
    await reportMonitoringEvent('socket_failure', error, {
      socketId: socket.id,
      phase: 'socket_error',
    });
  });
});

app.get('/health', (_req, res) => {
  const redisHealthy = redisUrl
    ? redisState.socketAdapter
      && redisState.queues
      && redisState.rateLimiter
      && (!runWorkers || redisState.workers)
    : false;
  const serviceOk = !requireRedis || redisHealthy;

  res.status(serviceOk ? 200 : 503);
  res.json({
    ok: serviceOk,
    redis: {
      enabled: redisState.enabled,
      required: redisState.required,
      mode: redisState.mode,
      healthy: redisHealthy,
      socketAdapter: redisState.socketAdapter,
      queues: redisState.queues,
      workers: redisState.workers,
      rateLimiter: redisState.rateLimiter,
      stateStore: Boolean(stateRedis),
      error: redisState.error,
    },
  });
});

app.get('/metrics', async (_req, res) => {
  try {
    const snapshot = await collectMetricsSnapshot();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(renderMetrics(snapshot));
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return res.status(500).json({ error: 'Could not collect metrics' });
  }
});

// ──────────────────────────────────────────────
// Auth Routes
// ──────────────────────────────────────────────

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (_) {
    return null;
  }
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  try {
    await connectDB();
    const username = cleanString(req.body?.username).toLowerCase();
    const displayName = cleanString(req.body?.displayName || req.body?.username);
    const password = req.body?.password;
    const avatar = cleanString(req.body?.avatar) || 'warrior';

    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3–30 characters' });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!AVAILABLE_AVATARS.includes(avatar)) {
      return res.status(400).json({ error: 'Invalid avatar selection' });
    }

    const existing = await UserModel.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ username, passwordHash, displayName, avatar });

    // Also upsert player profile
    await PlayerModel.findOneAndUpdate(
      { guestId: `user:${user._id}` },
      {
        $setOnInsert: {
          guestId: `user:${user._id}`,
          userId: user._id.toString(),
          displayName: displayName || username,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    const token = signToken({ userId: user._id.toString(), username });

    pushActivityEvent(`${displayName || username} joined the arena`);

    return res.status(201).json({
      token,
      user: {
        userId: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Registration failed' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    await connectDB();
    const username = cleanString(req.body?.username).toLowerCase();
    const password = req.body?.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await UserModel.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = signToken({ userId: user._id.toString(), username });

    return res.json({
      token,
      user: {
        userId: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
app.get('/auth/me', async (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

    await connectDB();
    const user = await UserModel.findById(payload.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const player = await PlayerModel.findOne({ guestId: `user:${user._id}` }).lean();

    return res.json({
      userId: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      rating: player?.rating || 1200,
      wins: player?.wins || 0,
      losses: player?.losses || 0,
      currentStreak: player?.currentStreak || 0,
      badges: player?.badges || [],
    });
  } catch (error) {
    return res.status(500).json({ error: 'Could not fetch user' });
  }
});

// GET /auth/avatars
app.get('/auth/avatars', (_req, res) => {
  res.json({ avatars: AVAILABLE_AVATARS });
});

// ──────────────────────────────────────────────
// Live Matches (Spectate)
// ──────────────────────────────────────────────

app.get('/live', async (req, res) => {
  try {
    await connectDB();

    const matches = await measureMongoQuery(
      'live.list',
      () => MatchModel.find({ status: 'RACING' })
        .sort({ startTime: -1 })
        .limit(50)
        .lean(),
    );

    // Enrich with problem titles in parallel
    const enriched = await Promise.all(matches.map(async (match) => {
      const [problem] = await Promise.all([
        Question.findById(match.problemId).select('title difficulty').lean(),
      ]);
      const timeLeft = Math.max(0, (match.endTime || 0) - Date.now());
      const spectators = await getSpectatorCount(match.matchId);

      return {
        matchId: match.matchId,
        players: match.players,
        participants: (match.participants || []).map((p) => ({
          participantId: p.participantId,
          displayName: p.displayName || p.participantId,
          rating: p.rating || 1200,
        })),
        problem: problem?.title || 'Unknown Problem',
        difficulty: problem?.difficulty || 'Easy',
        startTime: match.startTime,
        endTime: match.endTime,
        timeLeft,
        spectators,
        roomType: match.roomType || 'CASUAL',
      };
    }));

    return res.json({
      total: enriched.length,
      matches: enriched,
      activity: await getActivityFeed(10),
    });
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});


app.get('/admin/analytics', async (req, res) => {
  try {
    const requiredAdminKey = cleanString(process.env.ADMIN_ANALYTICS_KEY);
    if (requiredAdminKey) {
      const providedKey = cleanString(req.get('x-admin-key'));
      if (!providedKey || providedKey !== requiredAdminKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await connectDB();
    const analytics = await measureMongoQuery(
      'analytics.global',
      () => AnalyticsModel.findOne({ key: 'global' }).lean(),
    );

    const languageUsage = Object.entries(analytics?.languageUsage || {})
      .sort((a, b) => b[1] - a[1]);
    const averageMatchDurationMs = analytics?.matchesCompleted
      ? Math.round((analytics.totalMatchDurationMs || 0) / analytics.matchesCompleted)
      : 0;

    return res.json({
      roomsCreated: analytics?.roomsCreated || 0,
      roomsJoined: analytics?.roomsJoined || 0,
      matchesStarted: analytics?.matchesStarted || 0,
      matchesCompleted: analytics?.matchesCompleted || 0,
      abandonedMatches: analytics?.abandonedMatches || 0,
      averageMatchDurationMs,
      mostUsedProgrammingLanguages: languageUsage.map(([language, count]) => ({ language, count })),
    });
  } catch (error) {
    await reportMonitoringEvent('analytics_route_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError('Error fetching analytics', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/history', async (req, res) => {
  try {
    const identity = getCurrentIdentity(req.query || {});
    const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
    await connectDB();

    const query = identity.type === 'guest'
      ? { 'players.guestId': identity.guestId }
      : { 'players.userId': identity.userId };

    const history = await measureMongoQuery(
      'history.lookup',
      () => MatchHistoryModel.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
    );

    return res.json({
      identityType: identity.type,
      count: history.length,
      items: history,
    });
  } catch (error) {
    await reportMonitoringEvent('history_route_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError('Error fetching history', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

// ──────────────────────────────────────────────
// Leaderboard
// ──────────────────────────────────────────────
app.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query?.page) || 1, 1);
    const skip = (page - 1) * limit;
    await connectDB();

    const [players, total] = await Promise.all([
      measureMongoQuery(
        'leaderboard.list',
        () => PlayerModel.find({})
          .sort({ rating: -1, wins: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ),
      measureMongoQuery('leaderboard.count', () => PlayerModel.countDocuments()),
    ]);

    return res.json({
      page,
      limit,
      total,
      players: players.map((player, idx) => ({
        rank: skip + idx + 1,
        guestId: player.guestId,
        displayName: player.displayName || player.guestId,
        rating: player.rating,
        wins: player.wins,
        losses: player.losses,
        totalMatches: player.totalMatches,
        currentStreak: player.currentStreak,
        bestStreak: player.bestStreak,
        badges: player.badges || [],
        languageStats: Object.fromEntries(player.languageStats || []),
        lastActiveAt: player.lastActiveAt,
      })),
    });
  } catch (error) {
    await reportMonitoringEvent('leaderboard_route_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError('Error fetching leaderboard', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

// ──────────────────────────────────────────────
// Player Profile
// ──────────────────────────────────────────────
app.get('/profile/:guestId', async (req, res) => {
  try {
    const guestId = cleanString(req.params.guestId);
    if (!guestId) return res.status(400).json({ error: 'Missing guestId' });
    await connectDB();

    const player = await measureMongoQuery(
      'profile.lookup',
      () => PlayerModel.findOne({ guestId }).lean(),
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const recentHistory = await measureMongoQuery(
      'profile.history',
      () => MatchHistoryModel.find({ 'players.guestId': guestId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    );

    return res.json({
      guestId: player.guestId,
      displayName: player.displayName || player.guestId,
      rating: player.rating,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      totalMatches: player.totalMatches,
      currentStreak: player.currentStreak,
      bestStreak: player.bestStreak,
      badges: player.badges || [],
      languageStats: Object.fromEntries(player.languageStats || []),
      lastActiveAt: player.lastActiveAt,
      recentMatches: recentHistory,
    });
  } catch (error) {
    await reportMonitoringEvent('profile_route_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError('Error fetching profile', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

// ──────────────────────────────────────────────
// Daily Challenge
// ──────────────────────────────────────────────
app.get('/daily-challenge', async (req, res) => {
  try {
    await connectDB();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let daily = await measureMongoQuery(
      'daily.lookup',
      () => DailyChallengeModel.findOne({ date: today }).lean(),
    );

    if (!daily) {
      // Pick a random problem and seed as today's challenge
      const count = await measureMongoQuery('question.count_daily', () => Question.countDocuments());
      if (count === 0) return res.status(503).json({ error: 'No problems available' });

      // Use date-seeded selection for consistency
      const dayNum = Math.floor(Date.now() / 86400000);
      const problemIdx = dayNum % count;
      const problem = await measureMongoQuery(
        'daily.pick',
        () => Question.findOne().skip(problemIdx).lean(),
      );

      if (!problem) return res.status(503).json({ error: 'Could not load daily challenge' });

      daily = await measureMongoQuery(
        'daily.create',
        () => DailyChallengeModel.findOneAndUpdate(
          { date: today },
          { $setOnInsert: { date: today, problemId: problem._id.toString(), solvedBy: [], attemptCount: 0, solveCount: 0 } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ),
      );

      return res.json({
        date: today,
        problem: {
          id: problem._id.toString(),
          title: problem.title,
          difficulty: problem.difficulty,
          description: problem.description,
          task: problem.task,
          examples: problem.examples,
          input_format: problem.input_format,
          output_format: problem.output_format,
          template: problem.template,
        },
        solveCount: 0,
        attemptCount: 0,
      });
    }

    const problem = await measureMongoQuery(
      'daily.problem',
      () => Question.findById(daily.problemId).lean(),
    );

    return res.json({
      date: today,
      problem: problem ? {
        id: problem._id.toString(),
        title: problem.title,
        difficulty: problem.difficulty,
        description: problem.description,
        task: problem.task,
        examples: problem.examples,
        input_format: problem.input_format,
        output_format: problem.output_format,
        template: problem.template,
      } : null,
      solveCount: daily.solveCount,
      attemptCount: daily.attemptCount,
    });
  } catch (error) {
    await reportMonitoringEvent('daily_challenge_route_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError('Error fetching daily challenge', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

// ──────────────────────────────────────────────
// Tournaments
// ──────────────────────────────────────────────
app.get('/tournaments', async (req, res) => {
  try {
    await connectDB();
    const tournaments = await measureMongoQuery(
      'tournaments.list',
      () => TournamentModel.find({ status: { $in: ['REGISTRATION', 'ACTIVE'] } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    );
    return res.json({ tournaments });
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/tournament/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const identity = getCurrentIdentity(req.body || {});
    const organizerId = identity.type === 'guest' ? identity.guestId : identity.userId;
    await connectDB();

    if (action === 'create') {
      const name = cleanString(req.body.name);
      if (!name) return res.status(400).json({ error: 'Tournament name is required' });

      const format = cleanString(req.body.format || 'SINGLE_ELIMINATION').toUpperCase();
      if (!['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'COLLEGE_EVENT'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format' });
      }

      const maxParticipants = Math.min(Math.max(Number(req.body.maxParticipants) || 8, 2), 64);
      const problemDuration = [5, 10, 20].includes(Number(req.body.problemDuration))
        ? Number(req.body.problemDuration)
        : 10;

      const tournamentId = `t_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const tournament = await measureMongoQuery(
        'tournament.create',
        () => TournamentModel.create({
          tournamentId,
          name,
          format,
          maxParticipants,
          problemDuration,
          organizer: organizerId,
          participants: [organizerId],
          status: 'REGISTRATION',
        }),
      );
      return res.json({ tournamentId: tournament.tournamentId, name: tournament.name });
    }

    if (action === 'join') {
      const tournamentId = cleanString(req.body.tournamentId);
      if (!tournamentId) return res.status(400).json({ error: 'Missing tournamentId' });

      const tournament = await measureMongoQuery(
        'tournament.join',
        () => TournamentModel.findOneAndUpdate(
          {
            tournamentId,
            status: 'REGISTRATION',
            participants: { $ne: organizerId },
            $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
          },
          { $push: { participants: organizerId } },
          { new: true },
        ),
      );

      if (!tournament) return res.status(400).json({ error: 'Cannot join tournament' });
      return res.json({ msg: 'Joined tournament', participants: tournament.participants.length });
    }

    if (action === 'start') {
      const tournamentId = cleanString(req.body.tournamentId);
      const tournament = await measureMongoQuery(
        'tournament.lookup',
        () => TournamentModel.findOne({ tournamentId }),
      );
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      if (tournament.organizer !== organizerId) return res.status(403).json({ error: 'Only organizer can start' });
      if (tournament.status !== 'REGISTRATION') return res.status(400).json({ error: 'Tournament already started' });

      // Generate first round brackets
      const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5);
      const firstRound = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          firstRound.push({ player1: shuffled[i], player2: shuffled[i + 1], round: 1, status: 'PENDING' });
        } else {
          firstRound.push({ player1: shuffled[i], player2: null, round: 1, status: 'BYE', winner: shuffled[i] });
        }
      }

      tournament.rounds = [firstRound];
      tournament.status = 'ACTIVE';
      tournament.startTime = Date.now();
      await tournament.save();

      return res.json({ msg: 'Tournament started', rounds: tournament.rounds });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/tournament/:tournamentId', async (req, res) => {
  try {
    await connectDB();
    const { tournamentId } = req.params;
    const tournament = await measureMongoQuery(
      'tournament.get',
      () => TournamentModel.findOne({ tournamentId }).lean(),
    );
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    return res.json(tournament);
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.get('/match/:matchId', async (req, res) => {
  try {
    const matchId = validateMatchId(cleanString(req.params.matchId));
    await enforceRateLimit(req, res, 'matchRead', [matchId]);
    await connectDB();

    const game = await measureMongoQuery('match.read', () => MatchModel.findOne({ matchId }));
    if (!game) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const problem = await measureMongoQuery('question.read', () => Question.findById(game.problemId));

    return res.json({
      matchId: game.matchId,
      status: game.status,
      players: game.players,
      participants: game.participants || [],
      roomType: game.roomType || 'CASUAL',
      winnerId: game.winnerId || null,
      startTime: game.startTime || null,
      endTime: game.endTime || null,
      duration: game.duration,
      problem: problem ?? null,
    });
  } catch (error) {
    await reportMonitoringEvent('match_read_failure', error, { requestId: req.id });
    const status = Number(error.status || 500);
    logRouteError(`Error fetching match ${req.params.matchId}`, error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/match/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const identity = getCurrentIdentity(req.body || {});
    await enforceRateLimit(req, res, 'matchWrite', [action]);

    if (action === 'run' || action === 'submit') {
      await enforceRateLimit(req, res, 'code', [
        cleanString(req.body?.matchId),
        cleanString(req.body?.playerId),
      ]);
      if (identity.type === 'guest') {
        await enforceRateLimit(req, res, 'guestSubmission', [identity.guestId, action]);
      }
    }

    if (action === 'analyze') {
      await enforceRateLimit(req, res, 'ai', [
        cleanString(req.body?.matchId),
        cleanString(req.body?.playerId),
      ]);
    }
    if (action === 'create' && identity.type === 'guest') {
      await enforceRateLimit(req, res, 'guestRoomCreate', [identity.guestId]);
    }

    await connectDB();

    if (action === 'create') {
      return res.json(await createMatch(req.body || {}));
    }

    if (action === 'join') {
      return res.json(await joinMatch(req.body || {}));
    }

    if (action === 'run' || action === 'submit') {
      return res.json(await queueCodeRun(action, req.body || {}));
    }

    if (action === 'analyze') {
      return res.json(await queueAnalysis(req.body || {}));
    }

    return res.status(400).json({ error: 'Invalid Action' });
  } catch (error) {
    await reportMonitoringEvent('match_action_failure', error, {
      requestId: req.id,
      action: req.params.action,
    });
    const status = Number(error.status || 500);
    logRouteError('API Error', error, status);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
});

httpServer.listen(port, () => {
  console.log(`CodeBattle engine listening on http://localhost:${port}`);
});

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
process.on('unhandledRejection', (error) => {
  void reportMonitoringEvent('unhandled_rejection', error, { requestId: null });
  console.error('Unhandled rejection:', error);
});
process.on('uncaughtException', (error) => {
  void reportMonitoringEvent('uncaught_exception', error, { requestId: null });
  console.error('Uncaught exception:', error);
  void shutdown(1);
});

function readBooleanEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readPositiveIntEnv(name, defaultValue) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : defaultValue;
}

function parseTrustProxy(value) {
  if (!value) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const numericValue = Number(value);
  if (Number.isInteger(numericValue) && numericValue >= 0) return numericValue;

  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function validateRuntimeConfig() {
  if (!isProduction || allowInsecureProduction) {
    if (isProduction && allowInsecureProduction) {
      console.warn('ALLOW_INSECURE_PRODUCTION=true is set. Strict production checks are bypassed.');
    }
    return;
  }

  const issues = [];

  if (!process.env.MONGO_URI) {
    issues.push('MONGO_URI must be set in production.');
  }

  if (!redisUrl) {
    issues.push('REDIS_URL must be set in production.');
  }

  if (!requireRedis) {
    issues.push('REQUIRE_REDIS=true must be set in production.');
  }

  if (corsOrigin === true) {
    issues.push('CORS_ORIGIN must be set to explicit frontend origin(s) in production.');
  }

  if (issues.length > 0) {
    throw new Error(`Production configuration is not safe:\n- ${issues.join('\n- ')}`);
  }
}

function requestContext(req, res, next) {
  const startedAt = Date.now();
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      type: 'http_request',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: clientIp(req),
    }));
  });

  next();
}

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function jsonErrorHandler(error, _req, res, next) {
  if (!error) return next();

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  return next(error);
}

function logRouteError(label, error, status) {
  if (status >= 500) {
    console.error(`${label}:`, error);
    return;
  }

  console.warn(`${label}: ${error.message}`);
}

async function reportMonitoringEvent(kind, error, context = {}) {
  const payload = {
    kind,
    message: error?.message || String(error),
    stack: error?.stack || null,
    requestId: context.requestId || null,
    timestamp: Date.now(),
    context,
  };

  console.error(`[monitoring] ${kind}`, payload);

  if (!monitoringWebhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), monitoringTimeoutMs);

  try {
    await fetch(monitoringWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (monitoringError) {
    console.warn('Monitoring service unavailable:', monitoringError.message);
  } finally {
    clearTimeout(timeout);
  }
}

function incrementMetric(name, by = 1) {
  metricsState[name] = (metricsState[name] || 0) + by;
}

function recordRedisLatency(durationMs) {
  metricsState.lastRedisLatencyMs = durationMs;
  incrementMetric('redisLatencyChecks');
}

function recordMongoLatency(durationMs) {
  metricsState.mongoQueryDurationMs += durationMs;
  incrementMetric('mongoQueryCount');
}

function recordQueueProcessingLatency(durationMs) {
  metricsState.queueProcessingLatencyMs += durationMs;
  incrementMetric('queueProcessingCount');
}

function metricAverage(total, count) {
  return count > 0 ? total / count : 0;
}

async function measureMongoQuery(_label, task) {
  const started = Date.now();
  const value = await task();
  recordMongoLatency(Date.now() - started);
  return value;
}

async function incrementAnalytics(update, language = null) {
  await connectDB();
  const normalizedLanguage = cleanString(language);
  const languageKey = normalizedLanguage || null;

  const nextUpdate = { ...update };
  if (languageKey) {
    nextUpdate.$inc = {
      ...(nextUpdate.$inc || {}),
      [`languageUsage.${languageKey}`]: 1,
    };
  }
  if (!nextUpdate.$inc && !nextUpdate.$set && !nextUpdate.$setOnInsert) {
    nextUpdate.$setOnInsert = { key: 'global' };
  }

  await measureMongoQuery(
    'analytics.upsert',
    () => AnalyticsModel.findOneAndUpdate(
      { key: 'global' },
      nextUpdate,
      { upsert: true, setDefaultsOnInsert: true },
    ),
  );
}

async function persistMatchHistory(match, finalVerdict, fallbackLanguage = 'unknown') {
  if (!match?.matchId) return;

  const duration = getMatchElapsedDurationMs(match);
  const language = cleanString(fallbackLanguage || await getMatchLanguage(match.matchId)) || 'unknown';

  const question = await measureMongoQuery(
    'history.problem',
    () => Question.findById(match.problemId).select('title').lean(),
  );

  await measureMongoQuery(
    'history.upsert',
    () => MatchHistoryModel.findOneAndUpdate(
      { roomId: match.matchId },
      {
        $setOnInsert: {
          roomId: match.matchId,
          players: (match.participants || []).map((participant) => ({
            participantId: participant.participantId,
            guestId: participant.guestId,
            userId: participant.userId || null,
            displayName: participant.displayName || participant.participantId,
          })),
          winner: match.winnerId || null,
          duration,
          language,
          problem: question?.title || 'Unknown Problem',
          finalVerdict,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    ),
  );
}

function getMatchElapsedDurationMs(match) {
  return Math.max(
    0,
    Number((match.endTime || Date.now()) - (match.startTime || match.createdAt?.getTime?.() || Date.now())),
  );
}

async function collectMetricsSnapshot() {
  await connectDB();

  const activeMatches = await measureMongoQuery(
    'metrics.active_matches',
    () => MatchModel.countDocuments({ status: { $in: ['WAITING', 'RACING'] } }),
  );

  const queueSizes = {};
  if (queues) {
    for (const [name, queue] of Object.entries(queues)) {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      queueSizes[name] = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
    }
  }

  const redisClient = rateLimitRedis || redisClients.find((client) => typeof client?.ping === 'function');
  if (redisClient) {
    const started = Date.now();
    try {
      await redisClient.ping();
      recordRedisLatency(Date.now() - started);
    } catch (_error) {
      // Ignore ping failures for metrics endpoint.
    }
  }

  return {
    activeMatches,
    activeSockets: io.sockets.sockets.size,
    queueSizes,
    queueProcessingLatencyMsAvg: metricAverage(
      metricsState.queueProcessingLatencyMs,
      metricsState.queueProcessingCount,
    ),
    submissionCount: metricsState.submissionCount,
    matchCreationCount: metricsState.matchCreationCount,
    matchCompletionCount: metricsState.matchCompletionCount,
    redisLatencyMs: metricsState.lastRedisLatencyMs,
    mongoQueryLatencyMsAvg: metricAverage(
      metricsState.mongoQueryDurationMs,
      metricsState.mongoQueryCount,
    ),
  };
}

function renderMetrics(snapshot) {
  const lines = [
    '# HELP codebattle_active_matches Active matches in WAITING or RACING state',
    '# TYPE codebattle_active_matches gauge',
    `codebattle_active_matches ${snapshot.activeMatches}`,
    '# HELP codebattle_active_sockets Active Socket.IO client connections',
    '# TYPE codebattle_active_sockets gauge',
    `codebattle_active_sockets ${snapshot.activeSockets}`,
    '# HELP codebattle_queue_processing_latency_ms_avg Average queue processing latency in ms',
    '# TYPE codebattle_queue_processing_latency_ms_avg gauge',
    `codebattle_queue_processing_latency_ms_avg ${snapshot.queueProcessingLatencyMsAvg}`,
    '# HELP codebattle_submission_count Total submissions received',
    '# TYPE codebattle_submission_count counter',
    `codebattle_submission_count ${snapshot.submissionCount}`,
    '# HELP codebattle_match_creation_count Total match creations',
    '# TYPE codebattle_match_creation_count counter',
    `codebattle_match_creation_count ${snapshot.matchCreationCount}`,
    '# HELP codebattle_match_completion_count Total match completions',
    '# TYPE codebattle_match_completion_count counter',
    `codebattle_match_completion_count ${snapshot.matchCompletionCount}`,
    '# HELP codebattle_redis_latency_ms Latest Redis ping latency in ms',
    '# TYPE codebattle_redis_latency_ms gauge',
    `codebattle_redis_latency_ms ${snapshot.redisLatencyMs}`,
    '# HELP codebattle_mongo_query_latency_ms_avg Average Mongo query latency in ms',
    '# TYPE codebattle_mongo_query_latency_ms_avg gauge',
    `codebattle_mongo_query_latency_ms_avg ${snapshot.mongoQueryLatencyMsAvg}`,
  ];

  for (const [queueName, queueSize] of Object.entries(snapshot.queueSizes || {})) {
    lines.push(`# HELP codebattle_queue_size Queue depth for ${queueName}`);
    lines.push('# TYPE codebattle_queue_size gauge');
    lines.push(`codebattle_queue_size{queue="${queueName}"} ${queueSize}`);
  }

  return `${lines.join('\n')}\n`;
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function socketIp(socket) {
  return socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
}

async function enforceRateLimit(req, res, profileName, keyParts = []) {
  const result = await checkRateLimit(profileName, [clientIp(req), ...keyParts]);
  setRateLimitHeaders(res, result);

  if (!result.allowed) {
    throw httpError(429, 'Too many requests. Please slow down.');
  }
}

async function enforceSocketRateLimit(socket, profileName, keyParts = []) {
  const result = await checkRateLimit(profileName, [socketIp(socket), ...keyParts]);
  if (!result.allowed) {
    socket.emit('match:update', {
      type: 'RATE_LIMITED',
      reason: 'Too many socket events. Please slow down.',
      timestamp: Date.now(),
    });
    return false;
  }

  return true;
}

async function checkRateLimit(profileName, identityParts) {
  const profile = rateLimitProfiles[profileName];
  if (!profile || profile.max <= 0) {
    return { allowed: true, limit: 0, remaining: 0, resetInMs: 0 };
  }

  const key = rateLimitKey(profileName, identityParts);

  if (rateLimitRedis) {
    try {
      const count = await rateLimitRedis.incr(key);
      if (count === 1) {
        await rateLimitRedis.pexpire(key, profile.windowMs);
      }

      let ttl = await rateLimitRedis.pttl(key);
      if (ttl < 0) {
        ttl = profile.windowMs;
        await rateLimitRedis.pexpire(key, profile.windowMs);
      }

      return {
        allowed: count <= profile.max,
        limit: profile.max,
        remaining: Math.max(profile.max - count, 0),
        resetInMs: ttl,
      };
    } catch (error) {
      recordRedisError('Redis rate limiter error', error);
      if (requireRedis) {
        throw httpError(503, 'Rate limiter unavailable');
      }
    }
  }

  return checkLocalRateLimit(key, profile);
}

function checkLocalRateLimit(key, profile) {
  const now = Date.now();
  const existing = localRateLimits.get(key);

  if (!existing || existing.expiresAt <= now) {
    localRateLimits.set(key, { count: 1, expiresAt: now + profile.windowMs });
    pruneLocalRateLimits(now);
    return {
      allowed: true,
      limit: profile.max,
      remaining: Math.max(profile.max - 1, 0),
      resetInMs: profile.windowMs,
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= profile.max,
    limit: profile.max,
    remaining: Math.max(profile.max - existing.count, 0),
    resetInMs: existing.expiresAt - now,
  };
}

function pruneLocalRateLimits(now) {
  if (localRateLimits.size < 1000) return;

  for (const [key, value] of localRateLimits.entries()) {
    if (value.expiresAt <= now) {
      localRateLimits.delete(key);
    }
  }
}

function rateLimitKey(profileName, parts) {
  return [
    bullMqPrefix,
    'rate',
    profileName,
    ...parts.map((part) => Buffer.from(String(part || 'unknown')).toString('base64url')),
  ].join(':');
}

function setRateLimitHeaders(res, result) {
  if (!result.limit) return;

  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + result.resetInMs) / 1000)));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(result.resetInMs / 1000)));
  }
}

async function setupRedisScaling() {
  if (!redisUrl) {
    console.warn('REDIS_URL is not set. Running with in-memory timers and local Socket.IO only.');
    return;
  }

  try {
    await setupQueuesAndWorkers();
    await setupRateLimitRedis();
    await setupSocketRedisAdapter();
    await setupStateRedis();
    await recoverRunningMatchTimers();
    redisState.error = null;
    console.log('Redis scaling enabled for Socket.IO, queues, match timers, and shared state.');
  } catch (error) {
    redisState.error = error.message;
    await closeRedisResources();

    if (requireRedis) {
      throw error;
    }

    console.error('Redis setup failed. Falling back to local-only mode:', error);
    redisState.mode = 'local-fallback';
    queues = null;
    redisState.socketAdapter = false;
    redisState.queues = false;
    redisState.workers = false;
    redisState.rateLimiter = false;
  }
}

async function setupSocketRedisAdapter() {
  const pubClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: redisConnectTimeoutMs,
      reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
    },
  });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (error) => recordRedisError('Redis pub client error', error));
  subClient.on('error', (error) => recordRedisError('Redis sub client error', error));

  try {
    await withTimeout(
      Promise.all([pubClient.connect(), subClient.connect()]),
      redisConnectTimeoutMs,
      'Timed out connecting Socket.IO Redis adapter',
    );
  } catch (error) {
    safeDestroyRedisClient(pubClient);
    safeDestroyRedisClient(subClient);
    throw error;
  }

  io.adapter(createAdapter(pubClient, subClient));
  redisClients.push(pubClient, subClient);
  redisState.socketAdapter = true;
  redisState.mode = 'redis';
}

async function setupQueuesAndWorkers() {
  const queueConnection = createBullConnection('queues');
  queueConnection.on('error', (error) => {
    recordRedisError('Redis queue connection error', error);
  });

  queues = {
    code: new Queue(queueNames.code, { connection: queueConnection, prefix: bullMqPrefix }),
    analysis: new Queue(queueNames.analysis, { connection: queueConnection, prefix: bullMqPrefix }),
    timers: new Queue(queueNames.timers, { connection: queueConnection, prefix: bullMqPrefix }),
  };

  redisClients.push(queueConnection);

  await withTimeout(
    Promise.all(Object.values(queues).map((queue) => queue.waitUntilReady())),
    redisConnectTimeoutMs,
    'Timed out connecting Redis queues',
  );
  redisState.queues = true;

  if (!runWorkers) {
    console.log('RUN_WORKERS=false. Redis queues are enabled, but this process will not consume jobs.');
    return;
  }

  const codeConnection = createBullConnection('code-worker');
  const analysisConnection = createBullConnection('analysis-worker');
  const timerConnection = createBullConnection('timer-worker');

  codeConnection.on('error', (error) => {
    recordRedisError('Redis code worker connection error', error);
  });
  analysisConnection.on('error', (error) => {
    recordRedisError('Redis analysis worker connection error', error);
  });
  timerConnection.on('error', (error) => {
    recordRedisError('Redis timer worker connection error', error);
  });

  const codeWorker = new Worker(
    queueNames.code,
    async (job) => processCode(job.data),
    {
      connection: codeConnection,
      prefix: bullMqPrefix,
      concurrency: readPositiveIntEnv('CODE_WORKER_CONCURRENCY', 2),
      limiter: workerLimiter('CODE_WORKER', 20, 1000),
    },
  );

  const analysisWorker = new Worker(
    queueNames.analysis,
    async (job) => analyzeCode(job.data),
    {
      connection: analysisConnection,
      prefix: bullMqPrefix,
      concurrency: readPositiveIntEnv('AI_WORKER_CONCURRENCY', 1),
      limiter: workerLimiter('AI_WORKER', 5, 60000),
    },
  );

  const timerWorker = new Worker(
    queueNames.timers,
    async (job) => expireMatch(job.data.matchId),
    {
      connection: timerConnection,
      prefix: bullMqPrefix,
      concurrency: readPositiveIntEnv('TIMER_WORKER_CONCURRENCY', 4),
    },
  );

  for (const worker of [codeWorker, analysisWorker, timerWorker]) {
    worker.on('failed', (job, error) => {
      void reportMonitoringEvent('worker_failure', error, {
        queue: job?.queueName,
        jobId: job?.id,
      });
      console.error(`Redis job failed: ${job?.queueName}/${job?.id}`, error);
    });
    workers.push(worker);
  }

  redisClients.push(codeConnection, analysisConnection, timerConnection);
  await withTimeout(
    Promise.all(workers.map((worker) => worker.waitUntilReady())),
    redisConnectTimeoutMs,
    'Timed out connecting Redis workers',
  );
  redisState.workers = true;
}

async function setupRateLimitRedis() {
  rateLimitRedis = createBullConnection('rate-limit');
  rateLimitRedis.on('error', (error) => {
    recordRedisError('Redis rate limiter connection error', error);
  });

  redisClients.push(rateLimitRedis);

  await withTimeout(
    rateLimitRedis.ping(),
    redisConnectTimeoutMs,
    'Timed out connecting Redis rate limiter',
  );
  redisState.rateLimiter = true;
}

async function setupStateRedis() {
  stateRedis = createBullConnection('state');
  stateRedis.on('error', (error) => {
    recordRedisError('Redis state connection error', error);
  });
  redisClients.push(stateRedis);
  await withTimeout(stateRedis.ping(), redisConnectTimeoutMs, 'Timed out connecting Redis state client');
  console.log('Redis shared-state client ready.');
}

function createBullConnection(name) {
  return new IORedis(redisUrl, {
    connectionName: `codebattle:${name}:${process.pid}`,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: redisConnectTimeoutMs,
    commandTimeout: redisCommandTimeoutMs,
    retryStrategy: (retries) => Math.min(retries * 200, 5000),
  });
}

function workerLimiter(prefix, defaultMax, defaultDuration) {
  return {
    max: readPositiveIntEnv(`${prefix}_RATE_LIMIT_MAX`, defaultMax),
    duration: readPositiveIntEnv(`${prefix}_RATE_LIMIT_DURATION_MS`, defaultDuration),
  };
}

function recordRedisError(message, error) {
  redisState.error = `${message}: ${error.message}`;
  void reportMonitoringEvent('redis_failure', error, { message });
  console.error(`${message}:`, error);
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;

  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function safeDestroyRedisClient(client) {
  try {
    client.destroy();
  } catch (_error) {
    // Client may already be closed after a failed connection attempt.
  }
}

async function closeRedisResources() {
  const activeWorkers = workers.splice(0);
  const activeQueues = Object.values(queues || {});
  const activeClients = redisClients.splice(0);

  queues = null;
  rateLimitRedis = null;
  redisState.socketAdapter = false;
  redisState.queues = false;
  redisState.workers = false;
  redisState.rateLimiter = false;

  await Promise.allSettled(activeWorkers.map((worker) => worker.close()));
  await Promise.allSettled(activeQueues.map((queue) => queue.close()));
  await Promise.allSettled(activeClients.map((client) => closeRedisClient(client)));
}

async function closeRedisClient(client) {
  if (!client) return;

  if (typeof client.quit === 'function') {
    await client.quit();
    return;
  }

  if (typeof client.disconnect === 'function') {
    client.disconnect();
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, shutdownTimeoutMs);
  forceExit.unref?.();

  try {
    for (const timer of matchTimers.values()) {
      clearTimeout(timer);
    }
    matchTimers.clear();

    await closeRedisResources();
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (error) {
    console.error('Shutdown failed:', error);
    process.exit(1);
  }
}

function matchRoom(matchId) {
  return `match:${matchId}`;
}

function publishMatchEvent(matchId, event) {
  io.to(matchRoom(matchId)).emit('match:update', {
    ...event,
    matchId,
    timestamp: event.timestamp || Date.now(),
  });
}

async function emitCurrentMatchState(socket, matchId) {
  await connectDB();

  const match = await MatchModel.findOne({ matchId });
  if (!match) return;

  if (match.players.length >= 2) {
    const joinedParticipant = (match.participants || []).find(
      (participant) => participant.participantId === match.players[match.players.length - 1],
    );
    socket.emit('match:update', {
      matchId,
      type: 'PLAYER_JOINED',
      playerId: match.players[match.players.length - 1],
      displayName: joinedParticipant?.displayName || match.players[match.players.length - 1],
      players: match.players,
      participants: match.participants || [],
      timestamp: Date.now(),
    });
  }

  if (match.status === 'RACING') {
    socket.emit('match:update', {
      matchId,
      type: 'START_RACE',
      startTime: match.startTime,
      endTime: match.endTime,
      timestamp: Date.now(),
    });
  }

  if (match.status === 'FINISHED' || match.status === 'EXPIRED') {
    socket.emit('match:update', {
      matchId,
      type: 'GAME_OVER',
      winner: match.winnerId || null,
      reason: match.status === 'EXPIRED' ? 'TIME_LIMIT' : 'SOLVED',
      timestamp: Date.now(),
    });
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateMatchId(value) {
  const matchId = cleanString(value);

  if (!matchId) throw httpError(400, 'Missing matchId');
  if (matchId.length > maxMatchIdLength) throw httpError(400, 'matchId is too long');
  if (!/^[A-Za-z0-9_-]+$/.test(matchId)) {
    throw httpError(400, 'matchId can only contain letters, numbers, underscores, and hyphens');
  }

  return matchId;
}

function validatePlayerId(value) {
  const playerId = cleanString(value);

  if (!playerId) throw httpError(400, 'Missing playerId');
  if (playerId.length > maxPlayerIdLength) throw httpError(400, 'playerId is too long');
  if (/[\u0000-\u001F\u007F]/.test(playerId)) {
    throw httpError(400, 'playerId contains invalid characters');
  }

  return playerId;
}

function validateGuestId(value) {
  const guestId = cleanString(value);

  if (!guestId) throw httpError(400, 'Missing guestId');
  if (guestId.length > maxGuestIdLength) throw httpError(400, 'guestId is too long');
  if (/[\u0000-\u001F\u007F]/.test(guestId)) {
    throw httpError(400, 'guestId contains invalid characters');
  }

  return guestId;
}

function validateDisplayName(value, fallback = '') {
  const displayName = cleanString(value || fallback);
  if (!displayName) return '';
  if (displayName.length > maxDisplayNameLength) {
    return displayName.slice(0, maxDisplayNameLength);
  }
  if (/[\u0000-\u001F\u007F]/.test(displayName)) return '';
  return displayName;
}

function normalizeRoomType(value) {
  const roomType = cleanString(value).toUpperCase();
  if (!roomType) return 'CASUAL';
  if (roomType === 'CASUAL' || roomType === 'RANKED') return roomType;
  throw httpError(400, 'Invalid roomType. Use CASUAL or RANKED');
}

function getCurrentIdentity(source = {}, options = {}) {
  const { requireGuestId = true } = options;
  const userId = cleanString(source.userId);
  if (userId) {
    return {
      type: 'user',
      userId: validatePlayerId(userId),
    };
  }

  const fallbackGuestId = cleanString(source.guestId) || cleanString(source.playerId);
  if (!fallbackGuestId && !requireGuestId) {
    return {
      type: 'guest',
      guestId: null,
    };
  }
  return {
    type: 'guest',
    guestId: validateGuestId(fallbackGuestId),
  };
}

function resolveParticipant(body = {}) {
  const identity = getCurrentIdentity(body);
  const fallbackDisplayName = cleanString(body.displayName) || cleanString(body.playerId);
  const displayName = validateDisplayName(body.displayName, fallbackDisplayName);

  if (identity.type === 'user') {
    return {
      participantId: identity.userId,
      userId: identity.userId,
      guestId: validateGuestId(cleanString(body.guestId) || identity.userId),
      displayName: displayName || identity.userId,
      identity,
    };
  }

  return {
    participantId: identity.guestId,
    userId: null,
    guestId: identity.guestId,
    displayName: displayName || identity.guestId,
    identity,
  };
}

function validateCode(value, maxBytes = maxCodeBytes) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, 'Missing code');
  }

  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw httpError(413, `Code is too large. Max ${maxBytes} bytes allowed.`);
  }

  return value;
}

function validateProblemTitle(value) {
  const problemTitle = cleanString(value);
  if (!problemTitle) return 'Unknown Problem';
  if (problemTitle.length > maxProblemTitleLength) return problemTitle.slice(0, maxProblemTitleLength);
  if (/[\u0000-\u001F\u007F]/.test(problemTitle)) return 'Unknown Problem';
  return problemTitle;
}

function resolveRuntime(value) {
  const requestedLanguage = cleanString(value) || 'python';
  const runtime = languages.find((lang) => (
    lang.avail
    && (lang.pistonLang === requestedLanguage || lang.monacoLang === requestedLanguage)
  ));

  if (!runtime) {
    throw httpError(400, `Unsupported language: ${requestedLanguage}`);
  }

  return runtime;
}

function ensureMatchPlayer(match, playerId) {
  if (!match.players.includes(playerId)) {
    throw httpError(403, 'Player is not part of this match');
  }
}

async function createMatch(body) {
  const participant = resolveParticipant(body);
  const roomType = normalizeRoomType(body.roomType);
  if (roomType === 'RANKED' && participant.identity.type !== 'user') {
    throw httpError(403, 'RANKED rooms require authenticated users');
  }
  const requestedMatchId = cleanString(body.matchId);
  const { time } = body;

  const newMatchId = requestedMatchId ? validateMatchId(requestedMatchId) : `match_${randomUUID()}`;
  const selectedTime = Number(time);
  const validDuration = [5, 10, 20].includes(selectedTime) ? selectedTime : 5;
  const durationMs = validDuration * 60 * 1000;

  const count = await measureMongoQuery(
    'question.count',
    () => Question.countDocuments({ time: validDuration }),
  );
  if (count === 0) {
    throw httpError(500, `No questions found for ${validDuration} mins.`);
  }

  const randomQuestion = await measureMongoQuery(
    'question.pick',
    () => Question.findOne({ time: validDuration }).skip(Math.floor(Math.random() * count)),
  );
  if (!randomQuestion) {
    throw httpError(500, 'Error fetching question.');
  }

  try {
    await measureMongoQuery(
      'match.create',
      () => MatchModel.create({
      matchId: newMatchId,
      players: [participant.participantId],
      participants: [{
        participantId: participant.participantId,
        guestId: participant.guestId,
        userId: participant.userId,
        displayName: participant.displayName,
        rating: 1200,
        wins: 0,
        losses: 0,
      }],
      roomType,
      status: 'WAITING',
      problemId: randomQuestion._id.toString(),
      duration: durationMs,
      }),
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw httpError(409, 'Match ID already exists');
    }
    throw error;
  }

  incrementMetric('matchCreationCount');
  await incrementAnalytics({ $inc: { roomsCreated: 1 } });

  return {
    matchId: newMatchId,
    msg: 'Match Created',
    roomType,
    durationMinutes: validDuration,
    problemTitle: randomQuestion.title,
  };
}

async function joinMatch(body) {
  const matchId = validateMatchId(body.matchId);
  const participant = resolveParticipant(body);

  let game = await measureMongoQuery(
    'match.join',
    () => MatchModel.findOneAndUpdate(
    {
      matchId,
      status: 'WAITING',
      players: { $ne: participant.participantId },
      $expr: { $lt: [{ $size: '$players' }, 2] },
      ...(participant.identity.type !== 'user' ? { roomType: { $ne: 'RANKED' } } : {}),
    },
    {
      $push: {
        players: participant.participantId,
        participants: {
          participantId: participant.participantId,
          guestId: participant.guestId,
          userId: participant.userId,
          displayName: participant.displayName,
          rating: 1200,
          wins: 0,
          losses: 0,
        },
      },
    },
    { new: true },
    ),
  );

  if (!game) {
    game = await measureMongoQuery('match.lookup', () => MatchModel.findOne({ matchId }));
    if (!game) throw httpError(404, 'Match not found');

    if (game.roomType === 'RANKED' && participant.identity.type !== 'user') {
      throw httpError(403, 'RANKED rooms require authenticated users');
    }

    if (!game.players.includes(participant.participantId)) {
      if (game.status !== 'WAITING') {
        throw httpError(400, `Cannot join. Match is ${game.status}`);
      }
      throw httpError(400, 'Cannot join. Match already has two players');
    }
  }

  const problem = await measureMongoQuery('question.for_join', () => Question.findById(game.problemId));
  await incrementAnalytics({ $inc: { roomsJoined: 1 } });

  publishMatchEvent(matchId, {
    type: 'PLAYER_JOINED',
    playerId: participant.participantId,
    displayName: participant.displayName,
    players: game.players,
    participants: game.participants || [],
  });

  const latestGame = await maybeStartRace(matchId);

  return {
    msg: 'Joined',
    state: latestGame || game,
    durationMs: game.duration,
    roomType: game.roomType || 'CASUAL',
    problem: { title: problem?.title, description: problem?.description },
  };
}

async function queueCodeRun(action, body) {
  const requestType = body.type === 'RUN_TESTS' || body.type === 'SUBMIT_SOLUTION'
    ? body.type
    : (action === 'run' ? 'RUN_TESTS' : 'SUBMIT_SOLUTION');
  const matchId = validateMatchId(body.matchId);
  const participant = resolveParticipant(body);
  const code = validateCode(body.code);
  const runtime = resolveRuntime(body.language);

  const match = await measureMongoQuery('match.for_code', () => MatchModel.findOne({ matchId }));
  if (!match) throw httpError(404, 'Match not found');
  ensureMatchPlayer(match, participant.participantId);

  if (match.status !== 'RACING') {
    throw httpError(400, `Cannot run code. Match is ${match.status}`);
  }

  const jobData = {
    matchId,
    playerId: participant.participantId,
    code,
    action: requestType,
    language: runtime.pistonLang,
    version: runtime.version,
    enqueuedAt: Date.now(),
  };

  await setMatchLanguage(matchId, runtime.monacoLang || runtime.pistonLang || 'unknown');

  if (queues?.code) {
    try {
      await queues.code.add('run-code', jobData, {
      attempts: readPositiveIntEnv('CODE_JOB_ATTEMPTS', 2),
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 1000 },
      });
    } catch (error) {
      await reportMonitoringEvent('queue_failure', error, { queue: queueNames.code, matchId });
      throw error;
    }
  } else {
    processCode(jobData).catch((error) => {
      void reportMonitoringEvent('worker_failure', error, { worker: 'inline-code', matchId });
      console.error('Code runner failed:', error);
    });
  }

  if (requestType === 'SUBMIT_SOLUTION') {
    incrementMetric('submissionCount');
  }
  await incrementAnalytics(
    {},
    runtime.monacoLang || runtime.pistonLang || body.language || 'unknown',
  );

  return { msg: 'Code queued' };
}

async function queueAnalysis(body) {
  const matchId = validateMatchId(body.matchId);
  const participant = resolveParticipant(body);
  const code = validateCode(body.code, maxAiCodeBytes);
  const runtime = resolveRuntime(body.language);
  const problemTitle = validateProblemTitle(body.problemTitle);

  const match = await measureMongoQuery('match.for_analysis', () => MatchModel.findOne({ matchId }));
  if (!match) throw httpError(404, 'Match not found');
  ensureMatchPlayer(match, participant.participantId);

  publishMatchEvent(matchId, {
    type: 'AI_STATUS',
    playerId: participant.participantId,
  });

  const jobData = {
    matchId,
    playerId: participant.participantId,
    code,
    language: runtime.pistonLang,
    problemTitle,
    enqueuedAt: Date.now(),
  };

  if (queues?.analysis) {
    try {
      await queues.analysis.add('analyze-code', jobData, {
      attempts: readPositiveIntEnv('AI_JOB_ATTEMPTS', 2),
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 1000 },
      });
    } catch (error) {
      await reportMonitoringEvent('queue_failure', error, { queue: queueNames.analysis, matchId });
      throw error;
    }
  } else {
    analyzeCode(jobData).catch((error) => {
      void reportMonitoringEvent('worker_failure', error, { worker: 'inline-analysis', matchId });
      console.error('AI analysis failed:', error);
    });
  }

  return { msg: 'Analysis started. Watch the stream for results.' };
}

async function maybeStartRace(matchId) {
  const preMatch = await measureMongoQuery('match.before_start', () => MatchModel.findOne({ matchId }));

  if (!preMatch || preMatch.status !== 'WAITING' || preMatch.players.length < 2) {
    return preMatch;
  }

  const now = Date.now();
  const endTime = now + preMatch.duration;

  const updatedGame = await measureMongoQuery(
    'match.start',
    () => MatchModel.findOneAndUpdate(
      { matchId, status: 'WAITING' },
      { $set: { status: 'RACING', startTime: now, endTime } },
      { new: true },
    ),
  );

  if (!updatedGame) return preMatch;

  publishMatchEvent(matchId, {
    type: 'START_RACE',
    startTime: now,
    endTime,
  });

  await scheduleMatchExpiry(matchId, preMatch.duration);
  await incrementAnalytics({ $inc: { matchesStarted: 1 } });
  return updatedGame;
}

async function scheduleMatchExpiry(matchId, duration) {
  const delay = Math.max(0, Number(duration) || 0);

  if (queues?.timers) {
    const jobId = expiryJobId(matchId);

    await queues.timers.add(
      'expire-match',
      { matchId },
      {
        jobId,
        delay,
        attempts: readPositiveIntEnv('TIMER_JOB_ATTEMPTS', 3),
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    );
    return;
  }

  const existingTimer = matchTimers.get(matchId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    try {
      await expireMatch(matchId);
    } catch (error) {
      console.error(`Timer failed for match ${matchId}:`, error);
    } finally {
      matchTimers.delete(matchId);
    }
  }, delay);

  matchTimers.set(matchId, timer);
}

async function recoverRunningMatchTimers() {
  await connectDB();

  const now = Date.now();
  const runningMatches = await measureMongoQuery(
    'match.recover',
    () => MatchModel.find({ status: 'RACING' })
      .select('matchId startTime endTime duration')
      .lean(),
  );

  let scheduled = 0;
  let expired = 0;

  for (const match of runningMatches) {
    const fallbackEndTime = match.startTime ? match.startTime + match.duration : now;
    const endTime = match.endTime || fallbackEndTime;
    const delay = endTime - now;

    if (delay <= 0) {
      await expireMatch(match.matchId);
      expired += 1;
      continue;
    }

    await scheduleMatchExpiry(match.matchId, delay);
    scheduled += 1;
  }

  if (scheduled || expired) {
    console.log(`Recovered match timers. scheduled=${scheduled} expired=${expired}`);
  }
}

function expiryJobId(matchId) {
  return `match-expiry:${matchId}`;
}

async function cancelMatchExpiry(matchId) {
  const timer = matchTimers.get(matchId);
  if (timer) clearTimeout(timer);
  matchTimers.delete(matchId);

  if (!queues?.timers) return;

  try {
    const job = await queues.timers.getJob(expiryJobId(matchId));
    if (job) await job.remove();
  } catch (error) {
    console.warn(`Could not remove expiry job for ${matchId}:`, error.message);
  }
}

async function expireMatch(matchId) {
  await connectDB();

  const match = await measureMongoQuery(
    'match.expire',
    () => MatchModel.findOneAndUpdate(
      { matchId, status: 'RACING' },
      { $set: { status: 'EXPIRED', endTime: Date.now() } },
      { new: true },
    ),
  );

  if (match) {
    await persistMatchHistory(match, 'TIME_LIMIT', await getMatchLanguage(matchId));
    await incrementAnalytics({
      $inc: {
        matchesCompleted: 1,
        abandonedMatches: 1,
        totalMatchDurationMs: getMatchElapsedDurationMs(match),
      },
    });
    incrementMetric('matchCompletionCount');
    await deleteMatchLanguage(matchId);

    publishMatchEvent(matchId, {
      type: 'GAME_OVER',
      winner: null,
      reason: 'TIME_LIMIT',
    });
  }
}

async function processCode(data) {
  await connectDB();

  const {
    matchId,
    playerId,
    code,
    action,
    language = 'python',
    version = '3.10.0',
    enqueuedAt,
  } = data;

  let overallSuccess = true;
  let errorMsg;
  const testResults = [];

  if (enqueuedAt) {
    recordQueueProcessingLatency(Math.max(0, Date.now() - Number(enqueuedAt)));
  }

  try {
    const match = await measureMongoQuery('match.process', () => MatchModel.findOne({ matchId }));
    if (!match) throw new Error('Match not found');

    if (action === 'SUBMIT_SOLUTION' && match.status !== 'RACING') {
      throw new Error(`Cannot submit. Match is ${match.status}`);
    }

    const question = await measureMongoQuery('question.process', () => Question.findById(match.problemId));
    if (!question) throw new Error('Question not found');

    let casesToRun = question.test_cases;
    if (action === 'RUN_TESTS') {
      casesToRun = casesToRun.slice(0, Math.ceil(casesToRun.length * 0.25) || 1);
    }

    for (let i = 0; i < casesToRun.length; i += 1) {
      const testCase = casesToRun[i];
      const result = await runPiston(code, language, version, testCase);

      testResults.push({
        id: i + 1,
        input: testCase.input,
        expected: testCase.output,
        actual: result.output || result.stderr,
        status: result.status,
        passed: result.status === Verdict.ACCEPTED,
      });

      if (result.status !== Verdict.ACCEPTED) {
        overallSuccess = false;
        if (result.status === Verdict.COMPILE_ERROR) {
          errorMsg = result.stderr;
          break;
        }
      }

      if (i < casesToRun.length - 1) {
        await sleep(300);
      }
    }
  } catch (error) {
    overallSuccess = false;
    errorMsg = error.message || 'System Error';
  }

  await handleCodeProcessed({
    matchId,
    playerId,
    action,
    success: overallSuccess && !errorMsg,
    error: errorMsg,
    results: testResults,
  });
}

async function handleCodeProcessed(result) {
  publishMatchEvent(result.matchId, {
    type: 'CODE_FEEDBACK',
    playerId: result.playerId,
    action: result.action,
    success: result.success,
    error: result.error,
    results: result.results,
  });

  if (result.action !== 'SUBMIT_SOLUTION' || !result.success) {
    return;
  }

  const winningGame = await measureMongoQuery(
    'match.finish',
    () => MatchModel.findOneAndUpdate(
      { matchId: result.matchId, status: 'RACING' },
      { $set: { status: 'FINISHED', winnerId: result.playerId, endTime: Date.now() } },
      { new: true },
    ),
  );

  if (winningGame) {
    await cancelMatchExpiry(result.matchId);
    const language = await getMatchLanguage(result.matchId);
    await persistMatchHistory(winningGame, Verdict.ACCEPTED, language);
    await incrementAnalytics({
      $inc: { matchesCompleted: 1, totalMatchDurationMs: getMatchElapsedDurationMs(winningGame) },
    });
    incrementMetric('matchCompletionCount');
    await deleteMatchLanguage(result.matchId);

    // Update ELO ratings and player profiles
    await updatePlayerProfiles(winningGame, language).catch((error) => {
      console.error('Failed to update player profiles after match:', error);
    });

    publishMatchEvent(result.matchId, {
      type: 'GAME_OVER',
      winner: result.playerId,
      reason: 'SOLVED',
    });

    // Push to activity feed
    const winnerParticipant = winningGame.participants?.find((p) => p.participantId === result.playerId);
    const loserParticipant = winningGame.participants?.find((p) => p.participantId !== result.playerId);
    const wName = winnerParticipant?.displayName || result.playerId;
    const lName = loserParticipant?.displayName || 'opponent';
    pushActivityEvent(`${wName} defeated ${lName}`, 'win');
  }
}

// ──────────────────────────────────────────────
// ELO Rating & Player Profile Helpers
// ──────────────────────────────────────────────

/**
 * Calculate ELO rating change.
 * @param {number} winnerRating
 * @param {number} loserRating
 * @param {number} k - K-factor (default 32)
 * @returns {{ winnerDelta: number, loserDelta: number }}
 */
function calculateElo(winnerRating, loserRating, k = 32) {
  const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;
  const winnerDelta = Math.round(k * (1 - expectedWinner));
  const loserDelta = Math.round(k * (0 - expectedLoser));
  return { winnerDelta, loserDelta };
}

/**
 * Determine which badges a player has earned.
 * @param {{ wins: number, currentStreak: number, bestStreak: number, badges: Array }} player
 * @param {{ isFirstMatch: boolean, durationMs: number }} context
 */
function computeNewBadges(player, context) {
  const existing = new Set((player.badges || []).map((b) => b.id));
  const newBadges = [];

  const check = (id, name, icon) => {
    if (!existing.has(id)) newBadges.push({ id, name, icon, earnedAt: Date.now() });
  };

  if (context.isFirstMatch) check('first_victory', 'First Victory', '🏅');
  if (player.wins >= 10) check('10_wins', '10 Wins', '🥉');
  if (player.wins >= 50) check('50_wins', '50 Wins', '🥈');
  if (player.wins >= 100) check('100_wins', '100 Wins', '🏆');
  if (player.currentStreak >= 3) check('streak_3', '3 Win Streak 🔥', '🔥');
  if (player.currentStreak >= 5) check('streak_5', '5 Win Streak 🔥', '⚡');
  if (player.currentStreak >= 10) check('streak_10', '10 Win Streak 🔥', '💎');
  if (context.durationMs && context.durationMs < 60000) check('speed_demon', 'Speed Demon', '⚡');

  return newBadges;
}

/**
 * Upsert a player's profile after a match result.
 * @param {object} match - The finished match document
 * @param {string|null} language - Language used
 */
async function updatePlayerProfiles(match, language) {
  if (!match?.participants || match.participants.length < 2) return;

  const winnerId = match.winnerId;
  const participants = match.participants;
  const duration = getMatchElapsedDurationMs(match);
  const normalizedLang = cleanString(language) || 'unknown';

  // Load existing player records to get ratings
  const guestIds = participants.map((p) => p.guestId);
  const existingPlayers = await measureMongoQuery(
    'players.load_for_elo',
    () => PlayerModel.find({ guestId: { $in: guestIds } }).lean(),
  );

  const playerByGuestId = new Map(existingPlayers.map((p) => [p.guestId, p]));

  const winnerParticipant = participants.find((p) => p.participantId === winnerId);
  const loserParticipant = participants.find((p) => p.participantId !== winnerId);

  if (!winnerParticipant || !loserParticipant) return;

  const winnerDoc = playerByGuestId.get(winnerParticipant.guestId) || { rating: 1200, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, totalMatches: 0 };
  const loserDoc = playerByGuestId.get(loserParticipant.guestId) || { rating: 1200, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, totalMatches: 0 };

  const ranked = match.roomType === 'RANKED';
  let winnerDelta = 0;
  let loserDelta = 0;

  if (ranked) {
    ({ winnerDelta, loserDelta } = calculateElo(winnerDoc.rating, loserDoc.rating));
  }

  const newWinnerStreak = (winnerDoc.currentStreak || 0) + 1;
  const newBestStreak = Math.max(newWinnerStreak, winnerDoc.bestStreak || 0);

  // Update winner
  const winnerUpdate = {
    $set: {
      displayName: winnerParticipant.displayName || winnerParticipant.guestId,
      lastActiveAt: Date.now(),
      currentStreak: newWinnerStreak,
      bestStreak: newBestStreak,
    },
    $inc: {
      wins: 1,
      totalMatches: 1,
      totalMatchDurationMs: duration,
      rating: winnerDelta,
      [`languageStats.${normalizedLang}`]: 1,
    },
    $setOnInsert: { guestId: winnerParticipant.guestId },
  };

  const updatedWinner = await measureMongoQuery(
    'player.winner_update',
    () => PlayerModel.findOneAndUpdate(
      { guestId: winnerParticipant.guestId },
      winnerUpdate,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  );

  // Assign badges to winner
  const isFirstMatch = !playerByGuestId.has(winnerParticipant.guestId);
  const newBadges = computeNewBadges(
    { ...(updatedWinner?.toObject?.() || updatedWinner), wins: (winnerDoc.wins || 0) + 1, currentStreak: newWinnerStreak, bestStreak: newBestStreak },
    { isFirstMatch, durationMs: duration },
  );
  if (newBadges.length > 0) {
    await measureMongoQuery(
      'player.badge_push',
      () => PlayerModel.updateOne(
        { guestId: winnerParticipant.guestId },
        { $push: { badges: { $each: newBadges } } },
      ),
    );
  }

  // Update loser
  await measureMongoQuery(
    'player.loser_update',
    () => PlayerModel.findOneAndUpdate(
      { guestId: loserParticipant.guestId },
      {
        $set: {
          displayName: loserParticipant.displayName || loserParticipant.guestId,
          lastActiveAt: Date.now(),
          currentStreak: 0,
        },
        $inc: {
          losses: 1,
          totalMatches: 1,
          totalMatchDurationMs: duration,
          rating: loserDelta,
          [`languageStats.${normalizedLang}`]: 1,
        },
        $setOnInsert: { guestId: loserParticipant.guestId },
        $max: { bestStreak: loserDoc.bestStreak || 0 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  );
}

async function runPiston(code, language, version, testCase) {
  const runtime = languages.find((lang) => lang.pistonLang === language);
  const payload = {
    language: runtime?.pistonLang || language,
    version: runtime?.version || version || '*',
    files: [{ name: 'main', content: code }],
    stdin: testCase.input,
    run_timeout: 3000,
    compile_timeout: 10000,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pistonRequestTimeoutMs);

  try {
    const response = await fetch(pistonApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      return { status: Verdict.RUNTIME_ERROR, stderr: `API HTTP ${response.status}: ${text}` };
    }

    const data = await response.json();

    if (data.message) return { status: Verdict.RUNTIME_ERROR, stderr: data.message };
    if (data.compile && data.compile.code !== 0) {
      return { status: Verdict.COMPILE_ERROR, stderr: data.compile.stderr };
    }
    if (data.run && data.run.code !== 0) {
      return {
        status: Verdict.RUNTIME_ERROR,
        stderr: data.run.stderr || `Exited with code ${data.run.code}`,
      };
    }

    const actual = (data.run.stdout || '').trim();
    const expected = testCase.output.map((output) => output.trim());
    const isCorrect = expected.includes(actual);

    return { status: isCorrect ? Verdict.ACCEPTED : Verdict.WRONG_ANSWER, output: actual };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { status: Verdict.RUNTIME_ERROR, stderr: 'Piston request timed out' };
    }
    return { status: Verdict.RUNTIME_ERROR, stderr: `API Exception: ${error.message}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeCode(body) {
  const {
    matchId,
    playerId,
    code,
    language = 'python',
    problemTitle = 'Unknown Problem',
    enqueuedAt,
  } = body;
  let analysisResult = '';

  if (enqueuedAt) {
    recordQueueProcessingLatency(Math.max(0, Date.now() - Number(enqueuedAt)));
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert ICPC World Finalist Coach. Analyze this ${language} submission for the problem "${problemTitle}".

CODE:
${code}

Provide a tactical competitive programming analysis in Markdown. Be concise, maximum 200 words. Use these sections:

### Complexity & Constraints
* **Time:** <Big-O>.
* **Space:** <Big-O>.
* **Potential Pitfalls:** <List specific risks.>

### Algorithm & Logic
* **Approach:** <Identify the technique used.>
* **Better Alternative:** <Mention a better approach if one exists.>

### Edge Case Checklist
* <List 2 tricky inputs that might break this code.>

### Coach's Verdict
* <One sentence summary.>
`;

    const result = await withTimeout(
      model.generateContent(prompt),
      geminiRequestTimeoutMs,
      'Gemini request timed out',
    );
    analysisResult = result.response.text();
  } catch (_error) {
    const complexity = code.includes('for') && code.split('for').length > 2 ? 'O(n^2)' : 'O(n)';
    analysisResult = `
### Automated Fallback Review
**Time Complexity Estimate:** ${complexity}

* AI analysis is unavailable, so this is a quick static review.
* Syntax appears to be ${language}.
* ${complexity === 'O(n^2)' ? 'Detected nested loops. Watch large inputs.' : 'Logic appears linear from a quick scan.'}
`;
  }

  publishMatchEvent(matchId, {
    type: 'AI_ANALYSIS',
    playerId,
    text: analysisResult,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
