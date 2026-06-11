import { Router } from 'express';
import { getLiveMatches } from '../controllers/live.controller.js';

const router = Router();

router.get('/', getLiveMatches);

export default router;
