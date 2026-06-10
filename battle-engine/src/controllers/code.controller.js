// ─── Code Controller ──────────────────────────────────────────────────────────
// Thin HTTP layer – validates input then delegates to code.service.

import {
  queueSubmission,
  getSubmission,
  SUPPORTED_LANGUAGES,
} from '../services/code.service.js';
import { cleanString, validateMatchId, sendError, logRouteError } from '../utils/helpers.js';

// POST /code/submit
export async function submitCodeHandler(req, res) {
  try {
    const { matchId, participantId, language, code } = req.body ?? {};

    if (!matchId) return sendError(res, 400, 'matchId is required');
    if (!language) return sendError(res, 400, 'language is required');
    if (!code || typeof code !== 'string') return sendError(res, 400, 'code is required');
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return sendError(res, 400, `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    }

    const validMatchId = validateMatchId(cleanString(matchId));
    const submission = await queueSubmission({
      matchId: validMatchId,
      participantId: participantId ?? null,
      language,
      code,
    });

    return res.status(202).json({ submission });
  } catch (err) {
    logRouteError('submitCode', err);
    return sendError(res, 400, err.message);
  }
}

// GET /code/result/:submissionId
export async function getSubmissionResultHandler(req, res) {
  try {
    const submissionId = cleanString(req.params.submissionId);
    if (!submissionId) return sendError(res, 400, 'submissionId is required');

    const submission = await getSubmission(submissionId);
    return res.json({ submission });
  } catch (err) {
    logRouteError('getSubmissionResult', err);
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(res, status, err.message);
  }
}
