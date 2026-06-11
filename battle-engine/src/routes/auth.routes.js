import { Router } from 'express';
import {
  register,
  login,
  getMe,
  getAvatars,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', getMe);
router.get('/avatars', getAvatars);

export default router;
