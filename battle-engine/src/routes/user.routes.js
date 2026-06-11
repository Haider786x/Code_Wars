import { Router } from 'express';
import { getHistory, getLeaderboard, getProfile } from '../controllers/user.controller.js';

const router = Router();

router.get('/history', getHistory);
router.get('/leaderboard', getLeaderboard);
router.get('/profile/:guestId', getProfile);

export default router;
