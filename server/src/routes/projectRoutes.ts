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
  getProgramStatus,
  installPackages,
  setCluster,
  installNodeDependencies,
  runCommandController,
  compileTsController,
  startContainer,
  getContainerUrl,
  listProjects,
  getProgramId,
  relaySignedTxHandler,
  relayTx,
  getNonceAccount,
} from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';
import { buildProject, testProject, getBuildArtifact } from '../controllers/projectController';

const router = express.Router();

const DEV_AUTH = (req: any, _res: any, next: () => void) => {
  req.user = { id: '00000000-0000-0000-0000-000000000000' };
  next();
};
const guard = DEV_AUTH; 

router.get('/org/projects', guard, listProjects);
router.post('/run-command', authMiddleware, runCommandController);
router.post('/compile-ts', authMiddleware, compileTsController);
router.post('/create', guard, createProject);
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
router.get('/:id/program-status', authMiddleware, getProgramStatus);

router.get('/:id/program-id', authMiddleware, getProgramId);
router.post('/:id/relay-tx', authMiddleware, relayTx);
router.post('/:id/relay-signed-tx', authMiddleware, relaySignedTxHandler);
router.post('/:id/nonce', authMiddleware, getNonceAccount);
router.post('/:id/test', authMiddleware, testProject);
router.post('/:id/run-command', authMiddleware, runProjectCommand);
router.post('/:id/run-script', authMiddleware, runProjectCommand);
router.post('/:id/install-packages', authMiddleware, installPackages);
router.post('/:id/ephemeral', authMiddleware, createEphemeralKeypair);
router.post('/:projectId/install-node-dependencies', authMiddleware, installNodeDependencies);
router.get('/:id/local-port', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { exec } = require('child_process');

    exec(
      `docker ps --filter "label=solanaflow.project=${id}" ` +
      `--format "{{.Names}}" | head -n 1`,
      (err: Error | null, nameStdout: string) => {
        if (err || !nameStdout.trim()) {
          console.error('[projectRoutes] No running container for project', id);
          return res.status(404).json({ error: 'Container not found' });
        }

        const containerName = nameStdout.trim();
        exec(
          `docker container port ${containerName} 3000/tcp | head -1 | cut -d: -f2`,
          (portErr: Error | null, portStdout: string) => {
            if (portErr || !portStdout.trim()) {
              console.error('[projectRoutes] Port lookup failed for', containerName);
              return res.status(500).json({ error: 'Port lookup failed' });
            }

            res.json({ hostPort: portStdout.trim() });
          },
        );
      },
    );
  } catch (error) {
    console.error('[projectRoutes] Error in local-port endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
