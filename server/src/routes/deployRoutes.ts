import express from 'express';
import { deployPipeline } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/:id/deploy-pipeline', authMiddleware, deployPipeline);

export default router;
