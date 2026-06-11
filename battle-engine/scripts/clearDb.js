import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";

async function run() {
  await connectDB();
  console.log("Connected to MongoDB. Clearing questions collection...");
  await mongoose.connection.collection("questions").deleteMany({});
  console.log("Cleared all questions.");
  await mongoose.disconnect();
}

run().catch(console.error);
