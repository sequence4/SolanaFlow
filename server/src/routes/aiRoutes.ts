import express, { RequestHandler } from 'express';
import { generateAIResponse, handleAIChat } from '../controllers/aiController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/prompt', authMiddleware, generateAIResponse as RequestHandler);
router.post('/chat', authMiddleware, handleAIChat as RequestHandler);

export default router;
