import mongoose, { Schema } from 'mongoose';

const AnalyticsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    roomsCreated: { type: Number, default: 0 },
    roomsJoined: { type: Number, default: 0 },
    matchesStarted: { type: Number, default: 0 },
    matchesCompleted: { type: Number, default: 0 },
    abandonedMatches: { type: Number, default: 0 },
    totalMatchDurationMs: { type: Number, default: 0 },
    languageUsage: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true },
);

export const AnalyticsModel = mongoose.models.Analytics || mongoose.model('Analytics', AnalyticsSchema);
