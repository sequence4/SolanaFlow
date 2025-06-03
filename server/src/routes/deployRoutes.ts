import express from 'express';
import { deployPipeline, deploySignedTx, prepareDeployTx } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// -- TEMP: skip real auth while debugging ------------------------------------
const DEV_AUTH = (req: any, _res: any, next: () => void) => {
  /* provide a synthetic *valid UUID* so DB inserts succeed         */
  req.user = { id: '00000000-0000-0000-0000-000000000000' };
  // or use uuidv4() each time → req.user = { id: uuidv4() };
  next();
};
const guard = DEV_AUTH;              // <-- flip back to authMiddleware later
// ----------------------------------------------------------------------------

router.post('/:id/prepare-deploy-tx', guard, prepareDeployTx);
router.post('/:id/deploy-signed', guard, deploySignedTx);
router.post('/:id/deploy-pipeline', guard, deployPipeline);

export default router;
