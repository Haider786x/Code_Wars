import { connectDB } from '../db.js';
import { MatchModel } from '../models/Match.js';
import Question from '../models/Question.js';
import { getActivityFeed, getSpectatorCount } from '../services/live.service.js';
import { enforceRateLimit } from '../server.js';

export async function getLiveMatches(req, res) {
  try {
    await enforceRateLimit(req, res, 'default', ['live-matches']);
    await connectDB();

    const matches = await MatchModel.find({ status: 'RACING' })
      .sort({ startTime: -1 })
      .limit(50)
      .lean();

    // Enrich with problem titles in parallel
    const enriched = await Promise.all(matches.map(async (match) => {
      const problem = await Question.findById(match.problemId).select('title difficulty').lean();
      
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
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}
