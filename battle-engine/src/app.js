/* eslint-disable no-unused-vars */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env before anything else
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import matchRoutes from './routes/match.routes.js';
import authRoutes from './routes/auth.routes.js';
import liveRoutes from './routes/live.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import dailyRoutes from './routes/daily.routes.js';
import tournamentRoutes from './routes/tournament.routes.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: corsOrigins }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/live', liveRoutes);
app.use('/admin', adminRoutes);
app.use('/tournament', tournamentRoutes);
app.use('/daily-challenge', dailyRoutes);
app.use('/', userRoutes); // Has /history, /leaderboard, /profile/:guestId
app.use('/match', matchRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
 
app.use((err, _req, res, _next) => {
  console.error('[express] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
