import { NextFunction, Request, Response } from "express";
import { getContainerName } from "../../utils/container/getContainerName";
import { getProjectPorts } from "../container/getProjectPorts";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /projects/:id/local-validator/health
 * Health check for local validator - checks both process and RPC responsiveness
 */
export const getLocalValidatorHealth = async (
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      
      console.log(`[VALIDATOR_HEALTH] Checking health for project ${projectId}`);
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        res.json({ 
          healthy: false, 
          running: false,
          message: 'Container not found' 
        });
        return;
      }
      
      const ports = await getProjectPorts(projectId);
      
      const pidCheckCmd = `docker exec ${containerName} bash -c "[ -f /usr/local/validator-logs/validator.pid ] && cat /usr/local/validator-logs/validator.pid || echo 'no-pid'"`;
      const pidResult = await runCommand(pidCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (pidResult.trim() === 'no-pid') {
        res.json({ 
          healthy: false, 
          running: false,
          message: 'Validator not running (no PID file)' 
        });
        return;
      }
      
      const pid = pidResult.trim();
      
      const processCheckCmd = `docker exec ${containerName} bash -c "ps -p ${pid} > /dev/null 2>&1 && echo 'running' || echo 'dead'"`;
      const processStatus = await runCommand(processCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (processStatus.trim() !== 'running') {
        res.json({ 
          healthy: false, 
          running: false,
          pid,
          message: 'Validator process not found' 
        });
        return;
      }
      
      let rpcHealthy = false;
      let clusterVersion = null;
      let slotInfo = null;
      
      try {
        const rpcCheckCmd = `docker exec ${containerName} bash -c "curl -s -X POST http://localhost:8899 -H 'Content-Type: application/json' -d '{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"getVersion\\"}' | jq -r '.result[\\"solana-core\\"]' 2>/dev/null || echo 'no-response'"`;
        const rpcResult = await runCommand(rpcCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        
        if (rpcResult.trim() !== 'no-response') {
          rpcHealthy = true;
          clusterVersion = rpcResult.trim();
          
          const slotCmd = `docker exec ${containerName} bash -c "solana slot --url http://localhost:8899 2>/dev/null || echo '0'"`;
          const slotResult = await runCommand(slotCmd, '.', uuidv4(), { skipSuccessUpdate: true });
          slotInfo = parseInt(slotResult.trim()) || 0;
        }
      } catch (rpcError) {
        console.error('[VALIDATOR_HEALTH] RPC check failed:', rpcError);
      }
      
      let recentLogs = null;
      try {
        const logCmd = `docker exec ${containerName} bash -c "tail -n 5 /usr/local/validator-logs/validator.log 2>/dev/null | head -c 500"`;
        recentLogs = await runCommand(logCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      } catch (logError) {
      }
      
      const healthy = processStatus.trim() === 'running' && rpcHealthy;
      
      res.json({
        healthy,
        running: processStatus.trim() === 'running',
        rpcResponsive: rpcHealthy,
        pid,
        clusterVersion,
        currentSlot: slotInfo,
        rpcUrl: `http://localhost:${ports.rpc}`,
        faucetUrl: `http://localhost:${ports.faucet}`,
        websocketUrl: `ws://localhost:${ports.ws}`,
        recentLogs: recentLogs ? recentLogs.substring(0, 200) : null
      });
      
    } catch (error) {
      console.error('[VALIDATOR_HEALTH] Error:', error);
      res.json({ 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };