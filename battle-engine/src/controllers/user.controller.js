import { connectDB } from '../db.js';
import { PlayerModel } from '../models/Player.js';
import { MatchHistoryModel } from '../models/MatchHistory.js';
import { cleanString, getCurrentIdentity } from '../utils/helpers.js';
import { enforceRateLimit } from '../server.js';

export async function getHistory(req, res) {
  try {
    const identity = getCurrentIdentity(req.query || {});
    await enforceRateLimit(req, res, 'default', [`history:${identity.guestId}`]);
    const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
    await connectDB();

    const query = identity.type === 'guest'
      ? { 'players.guestId': identity.guestId }
      : { 'players.userId': identity.userId };

    const history = await MatchHistoryModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      identityType: identity.type,
      count: history.length,
      items: history,
    });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

export async function getLeaderboard(req, res) {
  try {
    await enforceRateLimit(req, res, 'default', ['leaderboard']);
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query?.page) || 1, 1);
    const skip = (page - 1) * limit;
    await connectDB();

    const [players, total] = await Promise.all([
      PlayerModel.find({})
        .sort({ rating: -1, wins: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PlayerModel.countDocuments(),
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
        languageStats: player.languageStats || {},
        lastActiveAt: player.lastActiveAt,
      })),
    });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}

export async function getProfile(req, res) {
  try {
    const guestId = cleanString(req.params.guestId);
    if (!guestId) return res.status(400).json({ error: 'Missing guestId' });
    await enforceRateLimit(req, res, 'default', [`profile:${guestId}`]);
    await connectDB();

    const player = await PlayerModel.findOne({ guestId }).lean();

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const recentHistory = await MatchHistoryModel.find({ 'players.guestId': guestId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

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
      languageStats: player.languageStats || {},
      lastActiveAt: player.lastActiveAt,
      recentMatches: recentHistory,
    });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}
