import 'dotenv/config';

const failures = [];
const warnings = [];

const required = ['MONGO_URI', 'REDIS_URL', 'CORS_ORIGIN'];
for (const name of required) {
  if (!process.env[name]) failures.push(`${name} is required`);
}

if (process.env.NODE_ENV !== 'production') {
  warnings.push('NODE_ENV is not set to production');
}

if (process.env.REQUIRE_REDIS !== 'true') {
  failures.push('REQUIRE_REDIS=true is required for production');
}

if (process.env.CORS_ORIGIN === '*') {
  failures.push('CORS_ORIGIN must be explicit, not *');
}

if (process.env.CORS_ORIGIN?.split(',').some((origin) => origin.trim() === '')) {
  failures.push('CORS_ORIGIN contains an empty origin');
}

if (process.env.MONGO_URI && /localhost|127\.0\.0\.1/.test(process.env.MONGO_URI)) {
  warnings.push('MONGO_URI points to localhost');
}

if (process.env.REDIS_URL && /localhost|127\.0\.0\.1/.test(process.env.REDIS_URL)) {
  warnings.push('REDIS_URL points to localhost');
}

if (!process.env.GEMINI_API_KEY) {
  warnings.push('GEMINI_API_KEY is not set; AI review will use fallback text');
}

for (const [name, value] of Object.entries(process.env)) {
  if (!name.endsWith('_MS') && !name.endsWith('_MAX') && !name.endsWith('_CONCURRENCY')) continue;
  if (Number.isNaN(Number(value)) || Number(value) <= 0) {
    failures.push(`${name} must be a positive number`);
  }
}

if (failures.length > 0) {
  console.error('Production readiness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  process.exit(1);
}

console.log('Production readiness check passed.');
for (const warning of warnings) console.warn(`warning: ${warning}`);
