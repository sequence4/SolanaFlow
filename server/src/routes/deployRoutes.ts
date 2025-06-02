import express from 'express';
import { deployPipeline, deploySignedTx } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/:id/deploy-signed', authMiddleware, deploySignedTx);
router.post('/:id/deploy-pipeline', authMiddleware, deployPipeline);

export default router;
