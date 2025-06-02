import express from 'express';
import { deployPipeline, deploySignedTx, prepareDeployTx } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// -- TEMP: skip auth while debugging -----------------------------------
const NOAUTH = (_req: unknown, _res: unknown, next: () => void) => next(); // pass-through
const guard = NOAUTH;          // <-- flip to authMiddleware when done
// ----------------------------------------------------------------------

router.post('/:id/prepare-deploy-tx', guard, prepareDeployTx);
router.post('/:id/deploy-signed', guard, deploySignedTx);
router.post('/:id/deploy-pipeline', guard, deployPipeline);

export default router;
