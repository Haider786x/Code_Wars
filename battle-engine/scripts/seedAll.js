// scripts/seedAll.js

import "dotenv/config";
import fs from "fs";
import path from "path";

import { connectDB } from "../src/db.js";
import Question from "../src/models/Question.js";

const CATEGORY_DIR = path.resolve("question-bank", "categories");

const REPORT_DIR = path.resolve("scripts", "generated");

const REPORT_FILE = path.join(REPORT_DIR, "seed-all-report.json");

async function seedAll() {
  try {
    console.log("[seed-all] Connecting...");

    await connectDB();

    console.log("[seed-all] Connected");

    const files = fs
      .readdirSync(CATEGORY_DIR)
      .filter((f) => f.endsWith(".json") && f !== "sample.json");

    const summary = {
      totalFiles: files.length,
      totalQuestions: 0,
      inserted: 0,
      skipped: 0,
      files: [],
      timestamp: new Date().toISOString(),
    };

    for (const file of files) {
      const filePath = path.join(CATEGORY_DIR, file);

      const questions = JSON.parse(fs.readFileSync(filePath, "utf8"));

      let inserted = 0;
      let skipped = 0;

      for (const question of questions) {
        const exists = await Question.findOne({
          slug: question.slug,
        }).lean();

        if (exists) {
          skipped++;
          continue;
        }

        await Question.create(question);
        inserted++;
      }

      summary.totalQuestions += questions.length;
      summary.inserted += inserted;
      summary.skipped += skipped;

      summary.files.push({
        file,
        questions: questions.length,
        inserted,
        skipped,
      });

      console.log(`✓ ${file} | inserted=${inserted} skipped=${skipped}`);
    }

    fs.mkdirSync(REPORT_DIR, {
      recursive: true,
    });

    fs.writeFileSync(REPORT_FILE, JSON.stringify(summary, null, 2));

    console.log("\n────────────────────────");
    console.log(`Total Questions : ${summary.totalQuestions}`);
    console.log(`Inserted        : ${summary.inserted}`);
    console.log(`Skipped         : ${summary.skipped}`);
    console.log("────────────────────────");

    process.exit(0);
  } catch (err) {
    console.error("[seed-all] Failed");
    console.error(err);
    process.exit(1);
  }
}

seedAll();
