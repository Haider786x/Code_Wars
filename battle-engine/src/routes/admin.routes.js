import { Router } from 'express';
import { getAnalytics } from '../controllers/admin.controller.js';

const router = Router();

router.get('/analytics', getAnalytics);

export default router;
