import mongoose, { Schema } from 'mongoose';

const TournamentMatchSchema = new Schema(
  {
    matchId: { type: String, default: null },
    player1: { type: String, default: null },
    player2: { type: String, default: null },
    winner: { type: String, default: null },
    round: { type: Number, required: true },
    bracket: { type: String, default: 'main' }, // main, losers
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'DONE', 'BYE'],
      default: 'PENDING',
    },
  },
  { _id: false },
);

const TournamentSchema = new Schema(
  {
    tournamentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    format: {
      type: String,
      enum: ['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'COLLEGE_EVENT'],
      default: 'SINGLE_ELIMINATION',
    },
    status: {
      type: String,
      enum: ['REGISTRATION', 'ACTIVE', 'FINISHED'],
      default: 'REGISTRATION',
    },
    participants: [{ type: String }], // list of guestIds/userIds
    maxParticipants: { type: Number, default: 8 },
    problemDuration: { type: Number, default: 10 }, // minutes per match
    rounds: { type: [[TournamentMatchSchema]], default: [] }, // array of rounds, each is an array of matches
    champion: { type: String, default: null },
    organizer: { type: String, required: true },
    startTime: { type: Number, default: null },
    endTime: { type: Number, default: null },
  },
  { timestamps: true },
);

TournamentSchema.index({ status: 1, createdAt: -1 });

export const TournamentModel =
  mongoose.models.Tournament || mongoose.model('Tournament', TournamentSchema);
