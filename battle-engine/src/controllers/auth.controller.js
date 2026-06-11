/* eslint-disable no-unused-vars */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { connectDB } from '../db.js';
import { UserModel, AVAILABLE_AVATARS } from '../models/User.js';
import { PlayerModel } from '../models/Player.js';
import { cleanString } from '../utils/helpers.js';
import { enforceRateLimit } from '../server.js';
import { pushActivityEvent } from '../services/live.service.js';

const jwtSecret = process.env.JWT_SECRET || 'codebattle-dev-secret-change-in-production';

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (_) {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function register(req, res) {
  try {
    await enforceRateLimit(req, res, 'auth', [req.body?.username || 'anonymous']);
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

    await pushActivityEvent(`${displayName || username} joined the arena`);

    return res.status(201).json({
      token,
      user: {
        userId: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (_error) {
    if (_error.status === 429) return;
    const status = Number(_error.status || 500);
    return res.status(status).json({ error: _error.message || 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    await enforceRateLimit(req, res, 'auth', [req.body?.username || 'anonymous']);
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
  } catch (_error) {
    if (_error.status === 429) return;
    return res.status(500).json({ error: 'Login failed' });
  }
}

export async function getMe(req, res) {
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
  } catch (_error) {
    return res.status(500).json({ error: 'Could not fetch user' });
  }
}

export function getAvatars(req, res) {
  res.json({ avatars: AVAILABLE_AVATARS });
}
