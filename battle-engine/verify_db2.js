import 'dotenv/config';
import { connectDB } from './src/db.js';
import mongoose from 'mongoose';

async function run() {
  await connectDB();
  const count = await mongoose.connection.collection('questions').countDocuments();
  console.log(`Questions count: ${count}`);
  const times = await mongoose.connection.collection('questions').distinct('timeLimitMinutes');
  console.log(`Distinct time limits:`, times);
  const matchCount = await mongoose.connection.collection('matches').countDocuments();
  console.log(`Matches count: ${matchCount}`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
