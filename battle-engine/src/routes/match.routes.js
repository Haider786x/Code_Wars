import express from 'express';
import {
  createMatchHandler,
  getMatchHandler,
  joinMatchHandler,
  finishMatchHandler,
} from '../controllers/match.controller.js';

const router = express.Router();

router.post('/create', createMatchHandler);        // POST /match/create
router.get('/:matchId', getMatchHandler);           // GET  /match/:matchId
router.post('/:matchId/join', joinMatchHandler);    // POST /match/:matchId/join
router.post('/:matchId/finish', finishMatchHandler);// POST /match/:matchId/finish

export default router;
