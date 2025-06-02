import express from 'express';
import { deployPipeline, deploySignedTx, prepareDeployTx } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/:id/deploy-signed', authMiddleware, deploySignedTx);
router.post('/:id/deploy-pipeline', authMiddleware, deployPipeline);
router.post('/build/:id/prepare-deploy-tx', authMiddleware, prepareDeployTx);

export default router;
