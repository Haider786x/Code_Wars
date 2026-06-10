import mongoose, { Schema } from 'mongoose';

const BadgeSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, default: '🎖' },
    earnedAt: { type: Number, default: Date.now },
  },
  { _id: false },
);

const PlayerSchema = new Schema(
  {
    guestId: { type: String, required: true, unique: true },
    userId: { type: String, default: null },
    displayName: { type: String, default: '' },
    rating: { type: Number, default: 1200 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    totalMatches: { type: Number, default: 0 },
    totalMatchDurationMs: { type: Number, default: 0 },
    lastActiveAt: { type: Number, default: Date.now },
    // Language usage map e.g. { javascript: 5, python: 3 }
    languageStats: {
      type: Map,
      of: Number,
      default: {},
    },
    badges: { type: [BadgeSchema], default: [] },
    // Daily challenge tracking
    dailyChallengeStreak: { type: Number, default: 0 },
    lastDailyChallengeDate: { type: String, default: null }, // ISO date string YYYY-MM-DD
  },
  { timestamps: true },
);

PlayerSchema.index({ rating: -1 });
PlayerSchema.index({ wins: -1 });

export const PlayerModel = mongoose.models.Player || mongoose.model('Player', PlayerSchema);
