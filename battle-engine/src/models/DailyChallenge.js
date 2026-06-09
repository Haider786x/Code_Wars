import mongoose, { Schema } from 'mongoose';

const DailyChallengeSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    problemId: { type: String, required: true },
    solvedBy: [{ type: String }], // array of guestIds/userIds who solved it
    attemptCount: { type: Number, default: 0 },
    solveCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

DailyChallengeSchema.index({ date: -1 });

export const DailyChallengeModel =
  mongoose.models.DailyChallenge || mongoose.model('DailyChallenge', DailyChallengeSchema);
