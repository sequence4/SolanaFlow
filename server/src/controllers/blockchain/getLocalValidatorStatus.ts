import { NextFunction, Request, Response } from "express";
import { getContainerName } from "../../utils/container/getContainerName";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /projects/:id/local-validator/status
 * Get detailed status of the local validator
 */
export const getLocalValidatorStatus = async (
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        res.json({ 
          running: false, 
          message: 'Container not found' 
        });
        return;
      }
      
      const statusCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh status`;
      const statusOutput = await runCommand(statusCmd, '.', uuidv4(), { skipSuccessUpdate: true })
        .catch(err => `Error: ${err.message}`);
      
      const isRunning = statusOutput.includes('Validator is running');
      const isResponsive = statusOutput.includes('RPC endpoint is responsive');
      
      let programCount = 0;
      let balance = null;
      
      if (isRunning) {
        try {
          const programCmd = `docker exec ${containerName} bash -c "solana program show --programs --url http://localhost:8899 2>/dev/null | grep -c '^[A-Za-z0-9]' || echo '0'"`;
          const programResult = await runCommand(programCmd, '.', uuidv4(), { skipSuccessUpdate: true });
          programCount = parseInt(programResult.trim()) || 0;
          
          if (req.query.walletPubkey) {
            const balanceCmd = `docker exec ${containerName} bash -c "solana balance ${req.query.walletPubkey} --url http://localhost:8899 2>/dev/null || echo '0'"`;
            const balanceResult = await runCommand(balanceCmd, '.', uuidv4(), { skipSuccessUpdate: true });
            balance = balanceResult.trim();
          }
        } catch (detailError) {
          console.warn('[VALIDATOR_STATUS] Error getting details:', detailError);
        }
      }
      
      res.json({
        running: isRunning,
        responsive: isResponsive,
        programCount,
        walletBalance: balance,
        rpcUrl: isRunning ? 'http://localhost:8899' : null,
        faucetUrl: isRunning ? 'http://localhost:9900' : null,
        websocketUrl: isRunning ? 'ws://localhost:8900' : null,
        statusOutput: statusOutput.substring(0, 500)
      });
      
    } catch (error) {
      console.error('[VALIDATOR_STATUS] Error:', error);
      res.json({ 
        running: false, 
        error: (error as Error).message 
      });
    }
  };