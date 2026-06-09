import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/codeduel';

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  if (globalThis.mongooseCache.conn) return globalThis.mongooseCache.conn;

  if (!globalThis.mongooseCache.promise) {
    globalThis.mongooseCache.promise = mongoose.connect(MONGO_URI).then((instance) => instance);
  }

  try {
    globalThis.mongooseCache.conn = await globalThis.mongooseCache.promise;
    return globalThis.mongooseCache.conn;
  } catch (error) {
    globalThis.mongooseCache.promise = null;
    throw error;
  }
}
