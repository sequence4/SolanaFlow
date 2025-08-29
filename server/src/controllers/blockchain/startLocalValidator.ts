import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getContainerName } from "../../utils/container/getContainerName";
import { getProjectPorts } from "../container/getProjectPorts";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import pool from "src/config/database";
import { startProjectContainer } from "../../utils/container";

/**
 * POST /projects/:id/local-validator/start
 * Start the local test validator with optional reset
 */
export const startLocalValidator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      const { reset = false, walletPubkey } = req.body;
      
      console.log(`[VALIDATOR_START] Starting validator for project ${projectId}`);
      console.log(`[VALIDATOR_START] Reset: ${reset}, Wallet: ${walletPubkey || 'none'}`);
      
      // First ensure the container is running
      let containerName = await getContainerName(projectId);
      if (!containerName) {
        console.log('[VALIDATOR_START] Container not found, starting container first');
        try {
          const containerInfo = await startProjectContainer(projectId);
          containerName = containerInfo.containerName;
          // Wait a bit for container to be fully ready
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error('[VALIDATOR_START] Failed to start container:', error);
          return next(new AppError('Failed to start container', 500));
        }
      } else {
        // Check if container is actually running
        const checkCmd = `docker ps --filter "name=${containerName}" --format "{{.Names}}"`;
        const runningContainers = await runCommand(checkCmd, '.', uuidv4(), { skipSuccessUpdate: true })
          .catch(() => '');
        
        if (!runningContainers.includes(containerName)) {
          console.log('[VALIDATOR_START] Container exists but not running, starting it');
          try {
            const containerInfo = await startProjectContainer(projectId);
            containerName = containerInfo.containerName;
            // Wait a bit for container to be fully ready
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.error('[VALIDATOR_START] Failed to start container:', error);
            return next(new AppError('Failed to start container', 500));
          }
        }
      }
      
      const ports = await getProjectPorts(projectId);
      
      const statusCmd = `docker exec ${containerName} /tmp/start-validator.sh status`;
      const currentStatus = await runCommand(statusCmd, '.', uuidv4(), { skipSuccessUpdate: true })
        .catch(() => 'not-running');
      
      if (currentStatus.includes('running') && !reset) {
        console.log('[VALIDATOR_START] Validator already running, returning existing info');
        res.json({ 
          message: 'Local validator already running',
          status: 'already-running',
          validatorRunning: true,
          rpcUrl: `http://localhost:${ports.rpc}`,
          faucetUrl: `http://localhost:${ports.faucet}`,
          websocketUrl: `ws://localhost:${ports.ws}`
        });
        return;
      }
      
      const command = reset ? 'reset' : '';
      const startCmd = walletPubkey 
        ? `docker exec -e WALLET_PUBKEY=${walletPubkey} ${containerName} /tmp/start-validator.sh ${command}`
        : `docker exec ${containerName} /tmp/start-validator.sh ${command}`;
      
      console.log(`[VALIDATOR_START] Executing: ${startCmd}`);
      
      const output = await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      console.log('[VALIDATOR_START] Script output:', output.substring(0, 500));
      
      const success = output.includes('Validator started successfully') || 
                     output.includes('Validator is ready');
      
      if (!success) {
        console.error('[VALIDATOR_START] Failed to start validator. Full output:', output);
        // Try to get validator logs for debugging
        const logCmd = `docker exec ${containerName} tail -50 /usr/local/validator-logs/validator.log 2>/dev/null || echo "No logs available"`;
        const logs = await runCommand(logCmd, '.', uuidv4(), { skipSuccessUpdate: true }).catch(() => 'Failed to get logs');
        console.error('[VALIDATOR_START] Validator logs:', logs);
        return next(new AppError(`Failed to start validator. Check server logs for details.`, 500));
      }
      
      await pool.query(
        `UPDATE solanaproject 
         SET details = jsonb_set(
           COALESCE(details, '{}'::jsonb),
           '{localValidator}',
           $1::jsonb
         )
         WHERE id = $2`,
        [
          JSON.stringify({
            active: true,
            rpcUrl: 'http://localhost:8899',
            faucetUrl: 'http://localhost:9900',
            websocketUrl: 'ws://localhost:8900',
            startedAt: new Date().toISOString()
          }),
          projectId
        ]
      );
      
      // Verify the validator is actually accessible
      console.log('[VALIDATOR_START] Verifying validator health...');
      const healthCheckCmd = `docker exec ${containerName} curl -s http://localhost:8899/health || echo "not-healthy"`;
      const healthStatus = await runCommand(healthCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (healthStatus.includes('ok')) {
        console.log('[VALIDATOR_START] Validator health check passed');
      } else {
        console.warn('[VALIDATOR_START] Validator health check returned:', healthStatus);
      }
      
      console.log('[VALIDATOR_START] Validator started successfully');
      
      res.json({
        message: reset ? 'Local validator reset and started' : 'Local validator started',
        status: 'started',
        validatorRunning: true,
        rpcUrl: `http://localhost:${ports.rpc}`,
        faucetUrl: `http://localhost:${ports.faucet}`,
        websocketUrl: `ws://localhost:${ports.ws}`,
        healthCheck: healthStatus.includes('ok') ? 'ok' : healthStatus.substring(0, 100),
        output: output.substring(0, 500)
      });
      
    } catch (error) {
      console.error('[VALIDATOR_START] Error:', error);
      next(new AppError(`Failed to start validator: ${(error as Error).message}`, 500));
    }
  };