import express from 'express';
import {
  submitCodeHandler,
  getSubmissionResultHandler,
} from '../controllers/code.controller.js';

const router = express.Router();

router.post('/submit', submitCodeHandler);                    // POST /code/submit
router.get('/result/:submissionId', getSubmissionResultHandler); // GET  /code/result/:submissionId

export default router;
