// scripts/seedQuestions.js

import "dotenv/config";
import fs from "fs";
import path from "path";

import { connectDB } from "../src/db.js";
import Question from "../src/models/Question.js";

const REPORT_DIR = path.resolve("scripts", "generated");
const REPORT_FILE = path.join(REPORT_DIR, "seed-report.json");

const category = process.argv[2];

if (!category) {
  console.error("Usage: node scripts/seedQuestions.js <category>");
  console.error("Example: node scripts/seedQuestions.js arrays");
  process.exit(1);
}

const filePath = path.resolve(
  "question-bank",
  "categories",
  `${category}.json`,
);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

async function seed() {
  try {
    console.log("[seed] Connecting to MongoDB...");

    await connectDB();

    console.log("[seed] Connected");

    const questions = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!Array.isArray(questions)) {
      throw new Error("Root JSON must be an array");
    }

    console.log(`[seed] Loaded ${questions.length} question(s)`);

    const report = {
      category,
      file: filePath,
      total: questions.length,
      inserted: 0,
      skipped: 0,
      duplicates: [],
      timestamp: new Date().toISOString(),
    };

    for (const question of questions) {
      const exists = await Question.findOne({
        slug: question.slug,
      }).lean();

      if (exists) {
        report.skipped++;
        report.duplicates.push(question.slug);
        continue;
      }

      await Question.create(question);
      report.inserted++;
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });

    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    console.log(`[seed] Inserted: ${report.inserted}`);
    console.log(`[seed] Skipped: ${report.skipped}`);
    console.log(`[seed] Report written to ${REPORT_FILE}`);

    process.exit(0);
  } catch (err) {
    console.error("[seed] Failed");
    console.error(err);
    process.exit(1);
  }
}

seed();
