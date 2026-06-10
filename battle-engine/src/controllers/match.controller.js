// ─── Match Controller ─────────────────────────────────────────────────────────
// Thin HTTP layer – validates input then delegates to match.service.

import {
  createMatch,
  getMatchById,
  joinMatch,
  finishMatch,
} from '../services/match.service.js';
import { cleanString, validateMatchId, sendError, logRouteError } from '../utils/helpers.js';

// POST /match/create
export async function createMatchHandler(req, res) {
  try {
    const { guestId, userId, displayName, roomType, language } = req.body ?? {};
    const match = await createMatch({ guestId, userId, displayName, roomType, language });
    return res.status(201).json({ match });
  } catch (err) {
    logRouteError('createMatch', err);
    return sendError(res, 400, err.message);
  }
}

// GET /match/:matchId
export async function getMatchHandler(req, res) {
  try {
    const matchId = validateMatchId(cleanString(req.params.matchId));
    const match = await getMatchById(matchId);
    return res.json({ match });
  } catch (err) {
    logRouteError('getMatch', err);
    const status = err.message === 'Match not found' ? 404 : 400;
    return sendError(res, status, err.message);
  }
}

// POST /match/:matchId/join
export async function joinMatchHandler(req, res) {
  try {
    const matchId = validateMatchId(cleanString(req.params.matchId));
    const { guestId, userId, displayName } = req.body ?? {};
    const match = await joinMatch(matchId, { guestId, userId, displayName });
    return res.json({ match });
  } catch (err) {
    logRouteError('joinMatch', err);
    const status = err.message === 'Match not found' ? 404 : 400;
    return sendError(res, status, err.message);
  }
}

// POST /match/:matchId/finish
export async function finishMatchHandler(req, res) {
  try {
    const matchId = validateMatchId(cleanString(req.params.matchId));
    const { winnerId } = req.body ?? {};
    if (!winnerId) return sendError(res, 400, 'winnerId is required');
    const match = await finishMatch(matchId, { winnerId });
    return res.json({ match });
  } catch (err) {
    logRouteError('finishMatch', err);
    const status = err.message === 'Match not found' ? 404 : 400;
    return sendError(res, status, err.message);
  }
}
