import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getProjectRootPath } from '../utils/fileUtils';
import { startProjectContainer } from '../utils/container';
import { runCommand } from '../utils/command-execution/runCommand';
import { startAnchorInitTask } from '../utils/anchor/startAnchorInitTask';
import { startCustomCommandTask } from '../utils/tasks/startCustomCommandTask';
import { startInstallPackagesTask } from '../utils/project/startInstallPackagesTask';
import { startSetClusterTask } from '../utils/anchor/startSetClusterTask';
import { startInstallNodeDependenciesTask } from '../utils/project/startInstallNodeDependenciesTask';
import { getContainerName } from '../utils/container/getContainerName';

const ephemeralKeys = new Map<string, Keypair>();


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
import { getProjectPorts } from './container/getProjectPorts';

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