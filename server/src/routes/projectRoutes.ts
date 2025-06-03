import express from 'express';
import {
  createProject,
  deleteProject,
  editProject,
  getProjectDetails,
  anchorInitProject,
  runProjectCommand,
  createEphemeralKeypair,
  deployProject,
  deployProjectEphemeral,
  installPackages,
  setCluster,
  createProjectDirectory,
  installNodeDependencies,
  runCommandController,
  compileTsController,
  startContainer,
  getContainerUrl,
} from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';
import { buildProject, testProject, getBuildArtifact } from '../controllers/projectController';
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

router.post('/run-command', authMiddleware, runCommandController);
router.post('/compile-ts', authMiddleware, compileTsController);
router.post('/create', guard, createProject);
router.post('/create-project-directory', authMiddleware, createProjectDirectory);
router.put('/update/:id', authMiddleware, editProject);
router.get('/details/:id', guard, getProjectDetails);
router.delete('/:id', authMiddleware, deleteProject);
router.post('/:id/start-container', authMiddleware, startContainer);
router.get('/:id/container-url', authMiddleware, getContainerUrl);
router.post('/init', authMiddleware, anchorInitProject);
router.post('/:id/set-cluster', authMiddleware, setCluster);
router.post('/:id/build', authMiddleware, buildProject);
router.get('/:id/build-artifact', authMiddleware, getBuildArtifact);
router.post('/:id/deploy', authMiddleware, deployProject);
router.post('/:id/deploy-ephemeral', authMiddleware, deployProjectEphemeral);
router.post('/:id/test', authMiddleware, testProject);
router.post('/:id/run-command', authMiddleware, runProjectCommand);
router.post('/:id/run-script', authMiddleware, runProjectCommand);
router.post('/:id/install-packages', authMiddleware, installPackages);
router.post('/:id/ephemeral', authMiddleware, createEphemeralKeypair);
router.post('/:projectId/install-node-dependencies', authMiddleware, installNodeDependencies);

export default router;
