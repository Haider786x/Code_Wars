// ─── Match Controller ─────────────────────────────────────────────────────────
// Thin HTTP layer – validates input then delegates to match.service.

import { queueCodeRun, queueAnalysis, createMatch, getMatchById, joinMatch, enforceRateLimit } from '../server.js';
import { cleanString, validateMatchId, sendError, logRouteError } from '../utils/helpers.js';

// POST /match/create
export async function createMatchHandler(req, res) {
  try {
    await enforceRateLimit(req, res, 'matchCreate', [req.body?.playerId || 'anonymous']);
    const result = await createMatch(req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    if (err.status === 429) return; // rate limit response already sent
    logRouteError('createMatch', err);
    return sendError(res, 400, err.message);
  }
}

// GET /match/:matchId
export async function getMatchHandler(req, res) {
  try {
    const matchId = validateMatchId(cleanString(req.params.matchId));
    await enforceRateLimit(req, res, 'matchRead', [matchId]);
    const result = await getMatchById(matchId);
    return res.json(result);
  } catch (err) {
    if (err.status === 429) return;
    logRouteError('getMatch', err);
    const status = err.message === 'Match not found' ? 404 : 400;
    return sendError(res, status, err.message);
  }
}

// POST /match/join
export async function joinMatchHandler(req, res) {
  try {
    await enforceRateLimit(req, res, 'matchJoin', [req.body?.playerId || 'anonymous']);
    const result = await joinMatch(req.body ?? {});
    return res.json(result);
  } catch (err) {
    if (err.status === 429) return;
    logRouteError('joinMatch', err);
    const status = err.message === 'Match not found' ? 404 : 400;
    return sendError(res, status, err.message);
  }
}

// POST /match/run
export async function runCodeHandler(req, res) {
  try {
    const result = await queueCodeRun('run', req.body ?? {});
    return res.json(result);
  } catch (err) {
    logRouteError('runCode', err);
    const status = err.status || (err.message.includes('not found') ? 404 : 400);
    return sendError(res, status, err.message);
  }
}

// POST /match/submit
export async function submitCodeHandler(req, res) {
  try {
    const result = await queueCodeRun('submit', req.body ?? {});
    return res.json(result);
  } catch (err) {
    logRouteError('submitCode', err);
    const status = err.status || (err.message.includes('not found') ? 404 : 400);
    return sendError(res, status, err.message);
  }
}

// POST /match/analyze
export async function analyzeCodeHandler(req, res) {
  try {
    const result = await queueAnalysis(req.body ?? {});
    return res.json(result);
  } catch (err) {
    logRouteError('analyzeCode', err);
    const status = err.status || (err.message.includes('not found') ? 404 : 400);
    return sendError(res, status, err.message);
  }
}
