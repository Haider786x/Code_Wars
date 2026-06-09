import mongoose, { Schema } from 'mongoose';

const MatchSchema = new Schema(
  {
    matchId: { type: String, required: true, unique: true },
    players: [{ type: String }],
    participants: [
      {
        participantId: { type: String, required: true },
        guestId: { type: String, required: true },
        userId: { type: String, default: null },
        displayName: { type: String, default: '' },
        rating: { type: Number, default: 1200 },
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
      },
    ],
    roomType: {
      type: String,
      enum: ['CASUAL', 'RANKED'],
      default: 'CASUAL',
    },
    status: {
      type: String,
      enum: ['WAITING', 'RACING', 'FINISHED', 'EXPIRED'],
      default: 'WAITING',
    },
    problemId: { type: String, default: 'two-sum' },
    winnerId: { type: String },
    startTime: { type: Number },
    duration: { type: Number, default: 300000 },
    endTime: { type: Number },
  },
  { timestamps: true },
);

MatchSchema.index({ status: 1, endTime: 1 });

export const MatchModel = mongoose.models.Match || mongoose.model('Match', MatchSchema);
