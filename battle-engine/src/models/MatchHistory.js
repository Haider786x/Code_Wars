import mongoose, { Schema } from 'mongoose';

const MatchHistorySchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true },
    players: [
      {
        participantId: { type: String, required: true },
        guestId: { type: String, required: true },
        userId: { type: String, default: null },
        displayName: { type: String, default: '' },
      },
    ],
    winner: { type: String, default: null },
    duration: { type: Number, default: 0 },
    language: { type: String, default: 'unknown' },
    problem: { type: String, default: 'Unknown Problem' },
    finalVerdict: { type: String, default: 'UNKNOWN' },
  },
  { timestamps: true },
);

MatchHistorySchema.index({ 'players.guestId': 1, createdAt: -1 });
MatchHistorySchema.index({ 'players.userId': 1, createdAt: -1 });

export const MatchHistoryModel = mongoose.models.MatchHistory || mongoose.model('MatchHistory', MatchHistorySchema);
