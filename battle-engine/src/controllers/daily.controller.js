import { connectDB } from '../db.js';
import { DailyChallengeModel } from '../models/DailyChallenge.js';
import Question from '../models/Question.js';
import { enforceRateLimit } from '../server.js';

export async function getDailyChallenge(req, res) {
  try {
    await enforceRateLimit(req, res, 'default', ['daily']);
    await connectDB();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let daily = await DailyChallengeModel.findOne({ date: today }).lean();

    if (!daily) {
      // Pick a random problem and seed as today's challenge
      const count = await Question.countDocuments();
      if (count === 0) return res.status(503).json({ error: 'No problems available' });

      // Use date-seeded selection for consistency
      const dayNum = Math.floor(Date.now() / 86400000);
      const problemIdx = dayNum % count;
      const problem = await Question.findOne().skip(problemIdx).lean();

      if (!problem) return res.status(503).json({ error: 'Could not load daily challenge' });

      daily = await DailyChallengeModel.findOneAndUpdate(
        { date: today },
        { $setOnInsert: { date: today, problemId: problem._id.toString(), solvedBy: [], attemptCount: 0, solveCount: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
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
          input_format: problem.params ? problem.params.map(p => `${p.name} (${p.type})`).join(', ') : 'None',
          output_format: problem.returnType || 'None',
          template: problem.starterCode,
        },
        solveCount: 0,
        attemptCount: 0,
      });
    }

    const problem = await Question.findById(daily.problemId).lean();

    return res.json({
      date: today,
      problem: problem ? {
        id: problem._id.toString(),
        title: problem.title,
        difficulty: problem.difficulty,
        description: problem.description,
        task: problem.task,
        examples: problem.examples,
        input_format: problem.params ? problem.params.map(p => `${p.name} (${p.type})`).join(', ') : 'None',
        output_format: problem.returnType || 'None',
        template: problem.starterCode,
      } : null,
      solveCount: daily.solveCount,
      attemptCount: daily.attemptCount,
    });
  } catch (error) {
    if (error.status === 429) return;
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message || 'Internal Server Error' });
  }
}
