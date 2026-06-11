import { connectDB } from '../db.js';
import { AnalyticsModel } from '../models/Analytics.js';
import { cleanString } from '../utils/helpers.js';

export async function getAnalytics(req, res) {
  try {
    const requiredAdminKey = cleanString(process.env.ADMIN_ANALYTICS_KEY);
    if (requiredAdminKey) {
      const providedKey = cleanString(req.get('x-admin-key'));
      if (!providedKey || providedKey !== requiredAdminKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await connectDB();
    const analytics = await AnalyticsModel.findOne({ key: 'global' }).lean();

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
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}
