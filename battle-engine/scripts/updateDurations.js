import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categoriesDir = path.join(__dirname, '..', 'question-bank', 'categories');
const durations = [5, 10, 20];
let dIndex = 0;

async function run() {
  const files = fs.readdirSync(categoriesDir).filter(f => f.endsWith('.json'));
  let total = 0;

  for (const file of files) {
    const filePath = path.join(categoriesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const questions = JSON.parse(content);

    for (const q of questions) {
      q.timeLimitMinutes = durations[dIndex % durations.length];
      dIndex++;
      total++;
    }

    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
  }

  console.log(`Updated ${total} questions with 5, 10, and 20 minute durations.`);
}

run().catch(console.error);
