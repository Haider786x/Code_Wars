import express from 'express';
import {
  createMatchHandler,
  getMatchHandler,
  joinMatchHandler,
  runCodeHandler,
  submitCodeHandler,
  analyzeCodeHandler,
} from '../controllers/match.controller.js';

const router = express.Router();

router.post('/create', createMatchHandler);
router.post('/join', joinMatchHandler);
router.post('/run', runCodeHandler);
router.post('/submit', submitCodeHandler);
router.post('/analyze', analyzeCodeHandler);
router.get('/:matchId', getMatchHandler);

export default router;
