import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getContainerName } from "../../utils/container/getContainerName";
import { getProjectPorts } from "../container/getProjectPorts";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import pool from "src/config/database";

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
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        return next(new AppError('Container not found', 404));
      }
      
      const ports = await getProjectPorts(projectId);
      
      const statusCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh status`;
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
        ? `docker exec -e WALLET_PUBKEY=${walletPubkey} ${containerName} /usr/local/bin/start-validator.sh ${command}`
        : `docker exec ${containerName} /usr/local/bin/start-validator.sh ${command}`;
      
      console.log(`[VALIDATOR_START] Executing: ${startCmd}`);
      
      const output = await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      const success = output.includes('Validator started successfully') || 
                     output.includes('Validator is ready');
      
      if (!success) {
        console.error('[VALIDATOR_START] Failed to start validator:', output);
        return next(new AppError(`Failed to start validator: ${output}`, 500));
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
      
      console.log('[VALIDATOR_START] Validator started successfully');
      
      res.json({
        message: reset ? 'Local validator reset and started' : 'Local validator started',
        status: 'started',
        validatorRunning: true,
        rpcUrl: `http://localhost:${ports.rpc}`,
        faucetUrl: `http://localhost:${ports.faucet}`,
        websocketUrl: `ws://localhost:${ports.ws}`,
        output: output.substring(0, 500)
      });
      
    } catch (error) {
      console.error('[VALIDATOR_START] Error:', error);
      next(new AppError(`Failed to start validator: ${(error as Error).message}`, 500));
    }
  };