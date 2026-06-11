import { Router } from 'express';
import { getDailyChallenge } from '../controllers/daily.controller.js';

const router = Router();

router.get('/', getDailyChallenge);

export default router;
