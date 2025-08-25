import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getProjectRootPath } from '../utils/fileUtils';
import { startProjectContainer } from '../utils/container';
import { runCommand } from '../utils/command-execution/runCommand';
import { startAnchorInitTask } from '../utils/anchor/startAnchorInitTask';
import { startAnchorTestTask } from '../utils/anchor/startAnchorTestTask';
import { startCustomCommandTask } from '../utils/tasks/startCustomCommandTask';
import { startInstallPackagesTask } from '../utils/project/startInstallPackagesTask';
import { getBuildArtifactTask } from '../utils/anchor/getBuildArtefactTask';
import { startSetClusterTask } from '../utils/anchor/startSetClusterTask';
import { startInstallNodeDependenciesTask } from '../utils/project/startInstallNodeDependenciesTask';
import { compileTs } from '../utils/compilation/compileTs';
import { getContainerName } from '../utils/container/getContainerName';

const ephemeralKeys = new Map<string, Keypair>();



async function getProjectPorts(projectId: string): Promise<{ rpc: number, ws: number, faucet: number }> {
  try {
    const result = await pool.query(
      'SELECT details->>\'containerPorts\' as ports, container_name FROM solanaproject WHERE id = $1',
      [projectId]
    );
    
    if (result.rows[0]?.ports) {
      return JSON.parse(result.rows[0].ports);
    }
    
    // If no ports stored but container exists, allocate them now
    if (result.rows[0]?.container_name) {
      console.log('[getProjectPorts] No ports stored, allocating new ones for', projectId);
      // Import the function from startProjectContainer
      const { findAvailablePorts } = await import('../utils/container/startProjectContainer');
      const ports = await findAvailablePorts();
      
      // Store them in database
      await pool.query(
        `UPDATE solanaproject 
         SET details = jsonb_set(COALESCE(details, '{}'::jsonb), '{containerPorts}', $1::jsonb)
         WHERE id = $2`,
        [JSON.stringify(ports), projectId]
      );
      
      console.log(`[getProjectPorts] Allocated and stored ports for ${projectId}:`, ports);
      return ports;
    }
  } catch (e) {
    console.warn('[getProjectPorts] Error:', e);
  }
  
  // Default fallback
  console.log('[getProjectPorts] Using fallback ports for project', projectId);
  return { rpc: 28899, ws: 28900, faucet: 28901 };
}

import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  NONCE_ACCOUNT_LENGTH,
} from '@solana/web3.js';

/* ------------------------------------------------------------------
 *  Upgrade‑loader program‑ID constant.
 *  Not exported by the v1.x typings, so we define it explicitly.
 *  https://explorer.solana.com/address/BPFLoaderUpgradeab1e11111111111111111111111
 * ----------------------------------------------------------------- */
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

/**
 * Ensure the server fee‑payer has enough lamports on‑chain before any
 * `BpfLoader.load()` call.  On Devnet/Testnet we transparently airdrop;
 * on Mainnet we throw with a clear message so the operator can fund the key.
 */
/*
async function ensureFeePayerBalance(
  connection: Connection,
  feePayer: Keypair,
  minLamports = 2 * LAMPORTS_PER_SOL,   // ≈2 SOL default cushion
): Promise<void> {
  const current = await connection.getBalance(
    feePayer.publicKey,
    'confirmed',
  );

  if (current >= minLamports) return; // already funded

  const rpc = connection.rpcEndpoint ?? '';
  const canAirdrop =
    rpc.includes('devnet') || rpc.includes('testnet') || rpc.includes('localhost');

  if (!canAirdrop) {
    throw new Error(
      `Fee‑payer ${feePayer.publicKey.toBase58()} has only ${current} lamports. ` +
      `Fund this account before deploying programs on ${rpc}.`,
    );
  }

  const needed = minLamports - current;
  const sig = await connection.requestAirdrop(feePayer.publicKey, needed);
  await connection.confirmTransaction(sig, 'finalized');
  console.log(
    `[DEPLOY] Airdropped ${(needed / LAMPORTS_PER_SOL).toFixed(2)} SOL ` +
      `to fee‑payer ${feePayer.publicKey.toBase58()} (tx: ${sig})`,
  );
}
  */

// fee‑payer will be the buffer‑authority keypair (funded by the wallet)

/**
 * Try to load the Anchor‑generated `<project>-keypair.json` that was created
 * during `anchor init / build`. Returns `null` if it can't be located.
 */
async function loadProgramKeypair(projectId: string): Promise<Keypair | null> {
  try {
    const containerName = await getContainerName(projectId);
    if (!containerName) return null;

    const rootPath  = await getProjectRootPath(projectId);
    const findId    = uuidv4();

    // ① project sub‑folder
    let keyPath = await runCommand(
      `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && \
       find target/deploy -maxdepth 1 -name "*-keypair.json" \
       ! -name "anchor_template-*" | head -n 1'`,
      '.',
      findId,
      { skipSuccessUpdate: true },
    );
    keyPath = keyPath.trim();

    // ② monorepo‑root fallback
    if (!keyPath) {
      keyPath = await runCommand(
        `docker exec ${containerName} bash -c 'find /usr/src/target/deploy \
         -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" | head -n 1'`,
        '.',
        findId,
        { skipSuccessUpdate: true },
      );
      keyPath = keyPath.trim();
    }
    if (!keyPath) return null;

    const raw = await runCommand(
      `docker exec ${containerName} bash -c "cat '${keyPath}'"`,
      '.',
      uuidv4(),
      { skipSuccessUpdate: true },
    );
    const arr = JSON.parse(raw.trim());
    if (Array.isArray(arr) && arr.length === 64) {
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
  } catch (e) {
    console.warn('[DEPLOY] loadProgramKeypair failed:', e);
  }
  return null;
}

import { catchAsync } from '../utils/middleware/catchAsync';
import { relaySignedTx } from './deploy/relaySignedTx';

export const runCommandController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { command, cwd } = req.body;

    if (!command || !cwd) {
      return next(
        new AppError('You must provide both "command" and "cwd" in the request body.', 400)
      );
    }

    const taskId = uuidv4();
    const output = await runCommand(command, cwd, taskId);

    res.status(200).json({
      message: 'Command executed successfully.',
      command,
      cwd,
      taskId,
      output,
    });
    return;
  } catch (error) {
    return next(error);
  }
};

export const anchorInitProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const org_id = req.user?.org_id;
  const userId = req.user?.id;
  if (!org_id || !userId) {
    return next(new AppError('User organization not found', 400));
  }

  const { projectId, projectName} = req.body;

  try {
    const projectResult = await pool.query(
      `SELECT details FROM solanaproject WHERE id = $1`,
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return next(new AppError('Project not found', 404));
    }

    const { details: detailsStr } = projectResult.rows[0];
    
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err) {
      console.error('Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    if ((details as any).isLite === true) {
      //console.log('Skipping Anchor initialization for lite project');
      res.status(200).json({ 
        message: 'Operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const rootPath = await getProjectRootPath(projectId);
    if(!rootPath) {
      return next(new AppError('Project root path not found', 400));
    }
    
    const taskId = await startAnchorInitTask(projectId, rootPath, projectName, userId);

    res.status(200).json({
      message: 'Anchor project initialization started successfully',
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const setCluster = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  try {
    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return next(new AppError('Project not found or no permission to access it', 404));
    }

    const taskId = await startSetClusterTask(id, userId);

    res.status(200).json({
      message: 'Anchor config set cluster devnet process started',
      taskId,
    });
  } catch (error) {
    console.error('Error in setCluster controller:', error);
    next(new AppError('Failed to set cluster devnet', 500));
  }
};

export const getProgramStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
      [id]
    );
    
    if (!result.rows.length) {
      res.json({ 
        deployed: false, 
        message: 'Project not found' 
      });
      return;
    }
    
    const details = result.rows[0]?.details;
    const programId = details?.projectState?.programId || details?.programId;
    const idl = details?.projectState?.idl;
    
    if (!programId) {
      res.json({ 
        deployed: false,
        message: 'No program ID found',
        hasIdl: false
      });
      return;
    }
    
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const programPubkey = new PublicKey(programId);
      const account = await connection.getAccountInfo(programPubkey);
      
      res.json({
        deployed: !!account,
        executable: account?.executable || false,
        owner: account?.owner?.toBase58() || null,
        programId,
        hasIdl: !!idl,
        idl: idl || null,
        rpcUrl
      });
    } catch (connectionError) {
      console.error('[getProgramStatus] RPC connection error:', connectionError);
      res.json({
        deployed: false,
        programId,
        hasIdl: !!idl,
        idl: idl || null,
        error: 'Failed to connect to Solana RPC'
      });
    }
  } catch (error) {
    console.error('[getProgramStatus] Database error:', error);
    next(new AppError('Failed to get program status', 500));
  }
};


export const getProgramId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    return next(new AppError('User not authenticated', 401));
  }
  try {
    const result = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return next(new AppError('Project not found or access denied', 404));
    }
    const detailsObj = (typeof result.rows[0].details === 'object')
      ? result.rows[0].details
      : JSON.parse(result.rows[0].details || '{}');

    const programId =
      detailsObj?.projectState?.programId ??
      detailsObj?.programId ??
      detailsObj?.lastProgramId;
    if (!programId) {
      return next(new AppError('Program ID not found for this project', 404));
    }

    res.status(200).json({ programId });
  } catch (err) {
    console.error('Error retrieving program ID:', err);
    next(new AppError('Failed to retrieve program ID', 500));
  }
};

export const runProjectCommand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { commandType, functionName, parameters, requiresUmi } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    
    const { ephemeralPubkey } = req.body;

    if (!userId || !orgId) {
      return next(new AppError('User information not found', 400));
    }

    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    if (functionName) {
     // console.log(`Executing function ${functionName} with parameters:`, parameters);
     // console.log(`UMI required: ${requiresUmi}`);
      
      const taskId = await startCustomCommandTask(id, userId, 'runFunction', functionName, parameters, ephemeralPubkey);
      
      res.status(200).json({
        message: `Function execution started`,
        taskId: taskId,
      });
      return;
    }

    if (!['anchor clean', 'cargo clean'].includes(commandType)) {
      return next(new AppError('Invalid command type', 400));
    }

    const taskId = await startCustomCommandTask(id, userId, commandType);

    res.status(200).json({
      message: `${commandType} process started`,
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const installPackages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { packages } = req.body;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands
  
  try {
    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    const taskId = await startInstallPackagesTask(id, userId, packages);

    res.status(200).json({
      message: 'NPM packages installation started successfully',
      taskId: taskId,
    });
  } catch (error) {
    console.error('Error in installPackages:', error);
    next(new AppError('Failed to start package installation process', 500));
  }
};

export const installNodeDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId } = req.params;
  const { packages } = req.body;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  if (!packages || !Array.isArray(packages)) {
    return next(new AppError('Packages array is required', 400));
  }

  try {
    const taskId = await startInstallNodeDependenciesTask(projectId, userId, packages);

    res.status(200).json({
      message: 'Dependency installation process started',
      taskId,
    });
  } catch (error) {
    next(error);
  }
};

export const startContainer = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    return next(new AppError('User not found', 400));
  }

  try {
    const container = await startProjectContainer(id);
    
    res.status(200).json({
      message: 'Container start process initiated',
      containerName: container.containerName,
      containerUrl: container.containerUrl
    });
  } catch (error) {
    next(error);
  }
};

export async function getContainerUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    // Query the database to get the container URL
    const { rows } = await pool.query(
      "SELECT container_url FROM solanaproject WHERE id = $1",
      [id]
    );

    if (!rows.length || !rows[0].container_url) {
      res.status(404).json({ 
        message: "Container URL not found for this project" 
      });
      return;
    }

    res.json({ containerUrl: rows[0].container_url });
    return;
  } catch (error) {
    next(error);
  }
}

export const relaySignedTxHandler = catchAsync(relaySignedTx);

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
    
    // Get dynamic ports for this project
    const ports = await getProjectPorts(projectId);
    
    // Check if validator process is running
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
    
    // Check if process with that PID exists
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
    
    // Check RPC endpoint responsiveness
    let rpcHealthy = false;
    let clusterVersion = null;
    let slotInfo = null;
    
    try {
      const rpcCheckCmd = `docker exec ${containerName} bash -c "curl -s -X POST http://localhost:8899 -H 'Content-Type: application/json' -d '{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"getVersion\\"}' | jq -r '.result[\\"solana-core\\"]' 2>/dev/null || echo 'no-response'"`;
      const rpcResult = await runCommand(rpcCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (rpcResult.trim() !== 'no-response') {
        rpcHealthy = true;
        clusterVersion = rpcResult.trim();
        
        // Get current slot for additional info
        const slotCmd = `docker exec ${containerName} bash -c "solana slot --url http://localhost:8899 2>/dev/null || echo '0'"`;
        const slotResult = await runCommand(slotCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        slotInfo = parseInt(slotResult.trim()) || 0;
      }
    } catch (rpcError) {
      console.error('[VALIDATOR_HEALTH] RPC check failed:', rpcError);
    }
    
    // Get last few log lines for diagnostics
    let recentLogs = null;
    try {
      const logCmd = `docker exec ${containerName} bash -c "tail -n 5 /usr/local/validator-logs/validator.log 2>/dev/null | head -c 500"`;
      recentLogs = await runCommand(logCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    } catch (logError) {
      // Non-critical, ignore
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
    
    // Get dynamic ports for this project
    const ports = await getProjectPorts(projectId);
    
    // Check current status first
    const statusCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh status`;
    const currentStatus = await runCommand(statusCmd, '.', uuidv4(), { skipSuccessUpdate: true })
      .catch(() => 'not-running');
    
    if (currentStatus.includes('running') && !reset) {
      console.log('[VALIDATOR_START] Validator already running, returning existing info');
      res.json({ 
        message: 'Local validator already running',
        status: 'already-running',
        rpcUrl: 'http://localhost:8899',
        faucetUrl: 'http://localhost:9900',
        websocketUrl: 'ws://localhost:8900'
      });
      return;
    }
    
    // Start or reset the validator
    const command = reset ? 'reset' : '';
    const startCmd = walletPubkey 
      ? `docker exec -e WALLET_PUBKEY=${walletPubkey} ${containerName} /usr/local/bin/start-validator.sh ${command}`
      : `docker exec ${containerName} /usr/local/bin/start-validator.sh ${command}`;
    
    console.log(`[VALIDATOR_START] Executing: ${startCmd}`);
    
    const output = await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Parse output to check if it started successfully
    const success = output.includes('Validator started successfully') || 
                   output.includes('Validator is ready');
    
    if (!success) {
      console.error('[VALIDATOR_START] Failed to start validator:', output);
      return next(new AppError(`Failed to start validator: ${output}`, 500));
    }
    
    // Update project details with validator info
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
      rpcUrl: `http://localhost:${ports.rpc}`,
      faucetUrl: `http://localhost:${ports.faucet}`,
      websocketUrl: `ws://localhost:${ports.ws}`,
      output: output.substring(0, 500) // First 500 chars of output for debugging
    });
    
  } catch (error) {
    console.error('[VALIDATOR_START] Error:', error);
    next(new AppError(`Failed to start validator: ${(error as Error).message}`, 500));
  }
};

/**
 * POST /projects/:id/local-validator/stop
 * Stop the local test validator
 */
export const stopLocalValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    
    console.log(`[VALIDATOR_STOP] Stopping validator for project ${projectId}`);
    
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      return next(new AppError('Container not found', 404));
    }
    
    const stopCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh stop`;
    const output = await runCommand(stopCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Update project details
    await pool.query(
      `UPDATE solanaproject 
       SET details = jsonb_set(
         COALESCE(details, '{}'::jsonb),
         '{localValidator,active}',
         'false'
       )
       WHERE id = $1`,
      [projectId]
    );
    
    console.log('[VALIDATOR_STOP] Validator stopped');
    
    res.json({
      message: 'Local validator stopped',
      status: 'stopped',
      output: output.substring(0, 500)
    });
    
  } catch (error) {
    console.error('[VALIDATOR_STOP] Error:', error);
    next(new AppError(`Failed to stop validator: ${(error as Error).message}`, 500));
  }
};

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
    
    // Use the validator script's status command
    const statusCmd = `docker exec ${containerName} /usr/local/bin/start-validator.sh status`;
    const statusOutput = await runCommand(statusCmd, '.', uuidv4(), { skipSuccessUpdate: true })
      .catch(err => `Error: ${err.message}`);
    
    const isRunning = statusOutput.includes('Validator is running');
    const isResponsive = statusOutput.includes('RPC endpoint is responsive');
    
    // Get additional details if running
    let programCount = 0;
    let balance = null;
    
    if (isRunning) {
      try {
        // Count deployed programs
        const programCmd = `docker exec ${containerName} bash -c "solana program show --programs --url http://localhost:8899 2>/dev/null | grep -c '^[A-Za-z0-9]' || echo '0'"`;
        const programResult = await runCommand(programCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        programCount = parseInt(programResult.trim()) || 0;
        
        // Get balance if wallet pubkey in request
        if (req.query.walletPubkey) {
          const balanceCmd = `docker exec ${containerName} bash -c "solana balance ${req.query.walletPubkey} --url http://localhost:8899 2>/dev/null || echo '0'"`;
          const balanceResult = await runCommand(balanceCmd, '.', uuidv4(), { skipSuccessUpdate: true });
          balance = balanceResult.trim();
        }
      } catch (detailError) {
        // Non-critical, continue
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

/**
 * GET /projects/:id/cluster-info
 * Get current cluster configuration for the project
 */
export const getProjectClusterInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { preferLocal } = req.query;
    
    // Import the cluster detection utilities
    const { getProjectCluster, testClusterConnection } = 
      await import('../utils/environment/clusterDetection');
    
    // Get project details to check for local deployment
    const projectResult = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return next(new AppError('Project not found', 404));
    }
    
    const details = projectResult.rows[0].details || {};
    const hasLocalDeployment = !!details.localProgramId;
    const hasDevnetDeployment = !!details.programId;
    
    // Get cluster config
    const cluster = await getProjectCluster(
      projectId, 
      preferLocal === 'true' || hasLocalDeployment
    );
    
    // Test the connection
    const connectionTest = await testClusterConnection(cluster.url);
    
    // Get program IDs for each environment
    const programIds = {
      local: details.localProgramId || null,
      devnet: details.programId || details.projectState?.programId || null
    };
    
    res.json({
      cluster,
      connectionTest,
      programIds,
      hasLocalDeployment,
      hasDevnetDeployment,
      recommendedCluster: hasLocalDeployment ? 'local' : 'devnet'
    });
    
  } catch (error) {
    console.error('[CLUSTER_INFO] Error:', error);
    next(new AppError('Failed to get cluster info', 500));
  }
};

/**
 * POST /projects/:id/switch-cluster
 * Switch between local and remote clusters
 */
export const switchProjectCluster = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { cluster, customUrl } = req.body;
    
    console.log(`[SWITCH_CLUSTER] Switching project ${projectId} to ${cluster}`);
    
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      return next(new AppError('Container not found', 404));
    }
    
    // Import cluster utilities
    const { getClusterConfig } = 
      await import('../utils/environment/clusterDetection');
    
    // Get cluster configuration
    const clusterConfig = getClusterConfig(
      cluster as any,
      customUrl
    );
    
    // Update Solana CLI config in container
    const configCmd = `docker exec ${containerName} bash -c "
      solana config set --url ${clusterConfig.url} &&
      solana config set --commitment confirmed
    "`;
    await runCommand(configCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Update Anchor.toml
    const rootPath = await getProjectRootPath(projectId);
    const anchorTomlPath = `/usr/src/${rootPath}/Anchor.toml`;
    
    const updateAnchorCmd = `docker exec ${containerName} bash -c "
      sed -i 's|cluster = .*|cluster = \\"${cluster === 'local' ? 'localnet' : cluster}\\"|g' ${anchorTomlPath}
    "`;
    await runCommand(updateAnchorCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Update web/.env.local
    const programId = cluster === 'local' 
      ? (await pool.query('SELECT details->\'localProgramId\' as pid FROM solanaproject WHERE id = $1', [projectId])).rows[0]?.pid
      : (await pool.query('SELECT details->\'programId\' as pid FROM solanaproject WHERE id = $1', [projectId])).rows[0]?.pid;
    
    const updateEnvCmd = `docker exec ${containerName} bash -c "
      cat > /usr/src/${rootPath}/web/.env.local << EOF
NEXT_PUBLIC_CLUSTER=${cluster}
NEXT_PUBLIC_RPC_URL=${clusterConfig.url}
NEXT_PUBLIC_WEBSOCKET_URL=${clusterConfig.websocketUrl}
NEXT_PUBLIC_PROGRAM_ID=${programId || ''}
EOF
    "`;
    await runCommand(updateEnvCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Update project details
    await pool.query(
      `UPDATE solanaproject 
       SET details = jsonb_set(
         COALESCE(details, '{}'::jsonb),
         '{currentCluster}',
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(clusterConfig), projectId]
    );
    
    // If switching to local, ensure validator is running
    if (cluster === 'local') {
      const validatorStatus = await runCommand(
        `docker exec ${containerName} /usr/local/bin/start-validator.sh status`,
        '.', uuidv4(), { skipSuccessUpdate: true }
      ).catch(() => 'not-running');
      
      if (!validatorStatus.includes('running')) {
        console.log('[SWITCH_CLUSTER] Starting local validator...');
        await runCommand(
          `docker exec ${containerName} /usr/local/bin/start-validator.sh`,
          '.', uuidv4(), { skipSuccessUpdate: true }
        );
      }
    }
    
    res.json({
      message: `Switched to ${clusterConfig.name}`,
      cluster: clusterConfig,
      programId
    });
    
  } catch (error) {
    console.error('[SWITCH_CLUSTER] Error:', error);
    next(new AppError(`Failed to switch cluster: ${(error as Error).message}`, 500));
  }
};