import express from 'express';
import {
  anchorInitProject,
  installNodeDependencies,
  startContainer,
  getContainerUrl,
  relaySignedTxHandler,
} from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';
import { listProjects } from '../controllers/project/listProject';
import { createProject } from '../controllers/project/createProject';
import { deleteProject } from '../controllers/project/deleteProject';
import { editProject } from '../controllers/project/editProject';
import { getProjectDetails } from '../controllers/project/getProjectDetails';
import { deployProjectEphemeral } from '../controllers/deploy/deployProjectEphemeral';
import { relayTx } from '../controllers/deploy/relayTx';
import { deployToLocalValidator } from '../controllers/deploy/deployToLocalValidator';
import { quickDeployLocal } from '../controllers/deploy/quickDeployLocal';
import { buildProject } from '../controllers/build/buildProject';
import { compileTsController } from '../controllers/build/compileTsController';
import { getBuildArtifact } from '../controllers/build/getBuildArtifact';
import { testProject } from '../controllers/project/testProject';
import { getNonceAccount } from '../controllers/blockchain/getNonceAccount';
import { createEphemeralKeypair } from '../controllers/blockchain/createEphemeralKeypair';
import { getProgramStatus } from '../controllers/blockchain/getProgramStatus';
import { getProgramId } from '../controllers/blockchain/getProgramId';
import { setCluster } from '../controllers/blockchain/setCluster';
import { getProjectClusterInfo } from '../controllers/blockchain/getProjectClusterInfo';
import { switchProjectCluster } from '../controllers/blockchain/switchProjectCluster';
import { getLocalValidatorHealth } from '../controllers/blockchain/getLocalValidatorHealth';
import { startLocalValidator } from '../controllers/blockchain/startLocalValidator';
import { stopLocalValidator } from '../controllers/blockchain/stopLocalValidator';
import { getLocalValidatorStatus } from '../controllers/blockchain/getLocalValidatorStatus';
import { runCommandController } from '../controllers/commands/runCommandController';
import { runProjectCommand } from '../controllers/commands/runProjectCommand';
import { installPackages } from '../controllers/project/installPackages';

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

// Local validator control endpoints
router.post('/:id/local-validator/start', guard, startLocalValidator);
router.post('/:id/local-validator/stop', guard, stopLocalValidator);
router.get('/:id/local-validator/status', guard, getLocalValidatorStatus);
router.get('/:id/local-validator/health', guard, getLocalValidatorHealth);

// Local deployment endpoints
router.post('/:id/local-validator/deploy', guard, deployToLocalValidator);
router.post('/:id/local-validator/quick-deploy', guard, quickDeployLocal);

// Cluster management endpoints
router.get('/:id/cluster-info', guard, getProjectClusterInfo);
router.post('/:id/switch-cluster', guard, switchProjectCluster);

// Get project's allocated ports
router.get('/:id/ports', guard, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = require('../config/database').default;
    
    const result = await pool.query(
      'SELECT details->>\'containerPorts\' as ports FROM solanaproject WHERE id = $1',
      [id]
    );
    
    const ports = result.rows[0]?.ports 
      ? JSON.parse(result.rows[0].ports)
      : { rpc: 28899, ws: 28900, faucet: 28901 };
      
    res.json({ ports });
  } catch (error) {
    console.error('[projectRoutes] Error fetching ports:', error);
    res.status(500).json({ error: 'Failed to fetch project ports' });
  }
});

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
