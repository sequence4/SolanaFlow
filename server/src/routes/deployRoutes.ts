import express from 'express';
import { deployPipeline, deploySignedTx, prepareDeployTx } from '../controllers/deployController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// -- TEMP: skip real auth while debugging ------------------------------------
const DEV_AUTH = (req: any, _res: any, next: () => void) => {
  /* provide a fake user so controllers don't bail out */
  req.user = { id: 'dev-user' };
  next();
};
const guard = DEV_AUTH;              // <-- flip back to authMiddleware later
// ----------------------------------------------------------------------------

router.post('/:id/prepare-deploy-tx', guard, prepareDeployTx);
router.post('/:id/deploy-signed', guard, deploySignedTx);
router.post('/:id/deploy-pipeline', guard, deployPipeline);

export default router;
