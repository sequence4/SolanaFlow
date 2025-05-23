import express, { RequestHandler } from 'express';
import { workspaceHeartbeat } from '../controllers/workspaceController';

const router = express.Router();

//  /workspace/heartbeat/:id   (no auth, internal use only)
router.post('/heartbeat/:id', workspaceHeartbeat as RequestHandler);

export default router;
