import fs from "fs";
import path from "path";

const VALID_TYPES = [
  "integer",
  "float",
  "string",
  "boolean",
  "integer[]",
  "float[]",
  "string[]",
  "boolean[]",
  "integer[][]",
  "string[][]",
  "linkedlist",
  "binarytree",
];

const VALID_DIFFICULTIES = ["Easy", "Medium", "Hard"];

const QUESTION_BANK_DIR = path.resolve("question-bank", "categories");
const REPORT_FILE = path.resolve("scripts/generated/validation-report.json");

// ─── Per-question validator ───────────────────────────────────────────────────

function validateQuestion(question, index, globalSlugSet, globalTitleSet) {
  const errors = [];

  // ── Required fields ──────────────────────────────────────────────────────────
  const requiredFields = [
    "slug",
    "title",
    "difficulty",
    "description",
    "constraints",
    "timeLimitMinutes",
    "functionName",
    "params",
    "returnType",
    "examples",
    "hiddenTestCases",
    "starterCode",
  ];

  for (const field of requiredFields) {
    if (question[field] === undefined || question[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // ── Difficulty ───────────────────────────────────────────────────────────────
  if (
    question.difficulty &&
    !VALID_DIFFICULTIES.includes(question.difficulty)
  ) {
    errors.push(`Invalid difficulty: ${question.difficulty}`);
  }

  // ── timeLimitMinutes ─────────────────────────────────────────────────────────
  if (question.timeLimitMinutes !== undefined) {
    const t = Number(question.timeLimitMinutes);
    if (!Number.isFinite(t) || t <= 0) {
      errors.push("timeLimitMinutes must be a positive number");
    }
  }

  // ── returnType ───────────────────────────────────────────────────────────────
  if (question.returnType && !VALID_TYPES.includes(question.returnType)) {
    errors.push(`Invalid returnType: ${question.returnType}`);
  }

  // ── functionName (must be valid camelCase identifier) ────────────────────────
  if (question.functionName) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(question.functionName)) {
      errors.push(
        `functionName "${question.functionName}" is invalid. Must be camelCase starting with a lowercase letter (e.g. twoSum, maxDepth).`,
      );
    }
  }

  // ── params ───────────────────────────────────────────────────────────────────
  if (!Array.isArray(question.params)) {
    errors.push("params must be an array");
  } else {
    question.params.forEach((param, i) => {
      if (!param.name) errors.push(`params[${i}] missing name`);
      if (!param.type) {
        errors.push(`params[${i}] missing type`);
      } else if (!VALID_TYPES.includes(param.type)) {
        errors.push(`params[${i}] invalid type: ${param.type}`);
      }
    });
  }

  // ── Type checker for a single value against a declared type ─────────────────
  function checkArgType(value, declaredType, label) {
    if (value === null) return; // null is always allowed (e.g. empty tree)
    const isInt = (v) => typeof v === "number" && Number.isFinite(v);
    const isFloat = (v) => typeof v === "number" && Number.isFinite(v);
    const isStr = (v) => typeof v === "string";
    const isBool = (v) => typeof v === "boolean";
    const isArr = (v) => Array.isArray(v);

    const checks = {
      integer: () => isInt(value),
      float: () => isFloat(value),
      string: () => isStr(value),
      boolean: () => isBool(value),
      "integer[]": () => isArr(value) && value.every(isInt),
      "float[]": () => isArr(value) && value.every(isFloat),
      "string[]": () => isArr(value) && value.every(isStr),
      "boolean[]": () => isArr(value) && value.every(isBool),
      "integer[][]": () =>
        isArr(value) && value.every((r) => isArr(r) && r.every(isInt)),
      "string[][]": () =>
        isArr(value) && value.every((r) => isArr(r) && r.every(isStr)),
      linkedlist: () =>
        isArr(value) && value.every((v) => v === null || isInt(v)),
      binarytree: () =>
        isArr(value) && value.every((v) => v === null || isInt(v)),
    };

    const check = checks[declaredType];
    if (check && !check()) {
      errors.push(
        `${label} value ${JSON.stringify(value)} does not match declared type "${declaredType}"`,
      );
    }
  }

  // ── Helper: validate a single test entry (example or hiddenTestCase) ─────────
  function validateTestEntry(entry, label) {
    if (!Array.isArray(entry.args)) {
      errors.push(`${label} args must be an array`);
    } else {
      // arg count must match param count
      if (
        Array.isArray(question.params) &&
        entry.args.length !== question.params.length
      ) {
        errors.push(
          `${label} arg count mismatch (got ${entry.args.length}, expected ${question.params.length})`,
        );
      }

      // check JS type of each arg matches declared param type
      if (Array.isArray(question.params)) {
        question.params.forEach((param, pi) => {
          if (pi < entry.args.length) {
            checkArgType(entry.args[pi], param.type, `${label}.args[${pi}]`);
          }
        });
      }
    }

    // check expected value matches returnType
    if (entry.expected === undefined) {
      errors.push(`${label} missing expected`);
    } else if (question.returnType) {
      checkArgType(entry.expected, question.returnType, `${label}.expected`);
    }
  }

  // ── examples (min 2, visible) ────────────────────────────────────────────────
  if (!Array.isArray(question.examples) || question.examples.length < 2) {
    errors.push("At least 2 examples are required");
  } else {
    question.examples.forEach((example, i) => {
      validateTestEntry(example, `examples[${i}]`);
    });
  }

  // ── hiddenTestCases (min 5) ───────────────────────────────────────────────────
  if (
    !Array.isArray(question.hiddenTestCases) ||
    question.hiddenTestCases.length < 5
  ) {
    errors.push("At least 5 hidden test cases are required");
  } else {
    question.hiddenTestCases.forEach((test, i) => {
      validateTestEntry(test, `hiddenTestCases[${i}]`);
    });
  }

  // ── starterCode ───────────────────────────────────────────────────────────────
  if (!question.starterCode || typeof question.starterCode !== "object") {
    errors.push("starterCode missing");
  } else {
    ["python", "javascript", "java"].forEach((lang) => {
      if (
        typeof question.starterCode[lang] !== "string" ||
        !question.starterCode[lang].trim()
      ) {
        errors.push(`starterCode.${lang} missing or empty`);
      }
    });
  }

  // ── Global duplicate slug/title check (across all files) ─────────────────────
  if (question.slug) {
    if (globalSlugSet.has(question.slug)) {
      errors.push(`Duplicate slug: ${question.slug}`);
    } else {
      globalSlugSet.add(question.slug);
    }
  }

  if (question.title) {
    const normalized = question.title.toLowerCase();
    if (globalTitleSet.has(normalized)) {
      errors.push(`Duplicate title: ${question.title}`);
    } else {
      globalTitleSet.add(normalized);
    }
  }

  return {
    index,
    slug: question.slug ?? null,
    title: question.title ?? null,
    valid: errors.length === 0,
    errors,
  };
}

// ─── Per-file validator ───────────────────────────────────────────────────────

function validateFile(filePath, globalSlugSet, globalTitleSet) {
  const raw = fs.readFileSync(filePath, "utf8");

  let questions;
  try {
    questions = JSON.parse(raw);
  } catch {
    return {
      file: path.basename(filePath),
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      results: [],
      fatalError: "Invalid JSON – could not parse file",
    };
  }

  if (!Array.isArray(questions)) {
    return {
      file: path.basename(filePath),
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      results: [],
      fatalError: "Root must be a JSON array",
    };
  }

  const results = questions.map((question, index) =>
    validateQuestion(question, index, globalSlugSet, globalTitleSet),
  );

  return {
    file: path.basename(filePath),
    totalQuestions: questions.length,
    validQuestions: results.filter((r) => r.valid).length,
    invalidQuestions: results.filter((r) => !r.valid).length,
    results,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function run() {
  // ── Argument guard ────────────────────────────────────────────────────────────
  const arg = process.argv[2]?.toLowerCase();
  if (!arg) {
    console.error("Usage: node scripts/validateQuestions.js <filename|all>");
    console.error("Example: node scripts/validateQuestions.js arrays");
    console.error("Example: node scripts/validateQuestions.js sample");
    console.error("Example: node scripts/validateQuestions.js all");
    process.exit(1);
  }

  // ── Resolve file list ─────────────────────────────────────────────────────────
  let files;
  if (arg === "all") {
    if (!fs.existsSync(QUESTION_BANK_DIR)) {
      console.error(
        `question-bank/ directory not found at: ${QUESTION_BANK_DIR}`,
      );
      process.exit(1);
    }
    files = fs
      .readdirSync(QUESTION_BANK_DIR)
      .filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      console.error("No JSON files found in question-bank/");
      process.exit(1);
    }
  } else {
    files = [`${arg}.json`];
  }

  // ── Global duplicate tracking (across all files) ───────────────────────────────
  const globalSlugSet = new Set();
  const globalTitleSet = new Set();

  const report = [];
  let totalValid = 0;
  let totalInvalid = 0;

  for (const file of files) {
    const fullPath = path.join(QUESTION_BANK_DIR, file);

    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      continue;
    }

    const result = validateFile(fullPath, globalSlugSet, globalTitleSet);
    report.push(result);

    totalValid += result.validQuestions;
    totalInvalid += result.invalidQuestions;

    // ── Per-file console output ────────────────────────────────────────────────
    const fileLabel = result.fatalError
      ? "❌"
      : result.invalidQuestions === 0
        ? "✅"
        : "⚠️ ";
    console.log(`\n${fileLabel}  ${result.file}`);

    if (result.fatalError) {
      console.log(`   Fatal: ${result.fatalError}`);
    } else {
      console.log(`   Questions : ${result.totalQuestions}`);
      console.log(`   Valid     : ${result.validQuestions}`);
      console.log(`   Invalid   : ${result.invalidQuestions}`);

      // Print errors for each invalid question
      result.results
        .filter((r) => !r.valid)
        .forEach((r) => {
          console.log(
            `\n   [${r.index}] ${r.slug ?? "(no slug)"} – ${r.title ?? "(no title)"}`,
          );
          r.errors.forEach((e) => console.log(`      • ${e}`));
        });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────");
  console.log(`Total valid   : ${totalValid}`);
  console.log(`Total invalid : ${totalInvalid}`);
  console.log("──────────────────────────────────────────");

  // ── Write report ──────────────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${REPORT_FILE}`);

  // ── Exit code (non-zero = CI fails) ───────────────────────────────────────────
  if (totalInvalid > 0) process.exit(1);
}

run();
