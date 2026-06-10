// ─── Code / Judge Service ─────────────────────────────────────────────────────
// Handles code submission queuing and result retrieval.
// NOTE: The actual execution logic (custom judge) will be wired in later.
//       This service is a clean placeholder that the controller calls.

import redis from '../utils/redis.js';
import { generateId } from '../utils/helpers.js';
import { languages } from '../utils/lang.js';

const SUBMISSION_KEY = (id) => `submission:${id}`;
const SUBMISSION_TTL = 60 * 30; // 30 minutes

/** Supported language identifiers (from lang.js) */
export const SUPPORTED_LANGUAGES = languages.map((l) => l.monacoLang);

/**
 * Queue a code submission for execution.
 * Returns a submissionId that the client can poll.
 */
export async function queueSubmission({ matchId, participantId, language, code }) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }

  const submissionId = generateId('sub-');
  const submission = {
    submissionId,
    matchId,
    participantId,
    language,
    code,
    status: 'PENDING',
    createdAt: Date.now(),
    result: null,
  };

  await redis.set(SUBMISSION_KEY(submissionId), JSON.stringify(submission), {
    EX: SUBMISSION_TTL,
  });

  // TODO: Push to BullMQ queue when custom judge is ready.
  // For now, immediately mark as queued (the custom judge will update this).
  console.log(`[code.service] Queued submission ${submissionId} for match ${matchId} (${language})`);

  return submission;
}

/**
 * Get the result of a previously queued submission.
 */
export async function getSubmission(submissionId) {
  const raw = await redis.get(SUBMISSION_KEY(submissionId));
  if (!raw) throw new Error('Submission not found or expired');
  return JSON.parse(raw);
}

/**
 * Update the result of a submission (called by the judge worker when ready).
 */
export async function updateSubmissionResult(submissionId, { status, stdout, stderr, passed, executionTimeMs }) {
  const raw = await redis.get(SUBMISSION_KEY(submissionId));
  if (!raw) throw new Error('Submission not found');

  const submission = JSON.parse(raw);
  submission.status = status; // 'ACCEPTED' | 'WRONG_ANSWER' | 'ERROR' | 'TIMEOUT'
  submission.result = { stdout, stderr, passed, executionTimeMs };
  submission.finishedAt = Date.now();

  await redis.set(SUBMISSION_KEY(submissionId), JSON.stringify(submission), {
    EX: SUBMISSION_TTL,
  });

  return submission;
}
