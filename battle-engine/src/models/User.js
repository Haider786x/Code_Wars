import mongoose, { Schema } from 'mongoose';

// Finite set of available avatar IDs players can choose at registration
export const AVAILABLE_AVATARS = [
  'warrior', 'ninja', 'wizard', 'dragon',
  'phoenix', 'titan', 'cipher', 'oracle',
  'ghost', 'shadow', 'storm', 'nexus',
];

const UserSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: '' },
    avatar: {
      type: String,
      default: 'warrior',
      enum: AVAILABLE_AVATARS,
    },
  },
  { timestamps: true },
);

UserSchema.index({ username: 1 });

export const UserModel =
  mongoose.models.User || mongoose.model('User', UserSchema);
