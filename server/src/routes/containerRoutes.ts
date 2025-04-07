import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as containerFileController from '../controllers/containerFileController';

const router = express.Router();

router.post('/projects/:projectId/files', authMiddleware, containerFileController.createFile);
router.put('/projects/:projectId/files/:filePath(*)', authMiddleware, containerFileController.updateFile);
router.get('/projects/:projectId/files/:filePath(*)', authMiddleware, containerFileController.getFileContent);
router.post('/projects/:projectId/install', authMiddleware, containerFileController.installDependencies);

export default router; 