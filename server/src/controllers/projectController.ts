import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getProjectRootPath } from '../utils/fileUtils';
import { startProjectContainer } from '../utils/container';
import { runCommand } from '../utils/command-execution/runCommand';
import { startAnchorBuildTask } from '../utils/anchor/startAnchorBuildTask';
import { startAnchorDeployTask } from '../utils/anchor/startAnchorDeployTask';
import { startAnchorInitTask } from '../utils/anchor/startAnchorInitTask';
import { startAnchorTestTask } from '../utils/anchor/startAnchorTestTask';
import { startCustomCommandTask } from '../utils/tasks/startCustomCommandTask';
import { startInstallPackagesTask } from '../utils/project/startInstallPackagesTask';
import { getBuildArtifactTask } from '../utils/anchor/getBuildArtefactTask';
import { startSetClusterTask } from '../utils/anchor/startSetClusterTask';
import { startInstallNodeDependenciesTask } from '../utils/project/startInstallNodeDependenciesTask';
import { compileTs } from '../utils/compilation/compileTs';
import { signDeployTxAndBroadcast } from '../utils/blockchain/signDeployTxAndBroadcast';
import { getContainerName } from '../utils/container/getContainerName';
import path from 'path';
import { APP_CONFIG } from '../config/appConfig';
import { Buffer } from 'buffer';
import fs from 'fs';

/**
 * Helper function to get project's allocated ports from database
 */
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
/*  --------------------------------------------------------------------
    NOTE:  BpfLoader is flagged "deprecated" in @solana/web3.js v1.98.x
           because a new loader API is coming in v2.  There is **no**
           replacement in v1.x, so we keep using it and suppress the
           lint warning until we migrate to v2.
    -------------------------------------------------------------------- */
/* eslint-disable-next-line deprecation/deprecation */
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SendTransactionError,
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

import { deployOrUpgradeUpgradeable } from '../solana/upgradeableDeploy';

// In-memory storage for ephemeral keypairs
const ephemeralKeys = new Map<string, Keypair>();

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

import { waitForTaskCompletion } from '../utils/taskUtils';
import { createProject as createProjectDb } from '../utils/project/createProject';
import { catchAsync } from '../utils/middleware/catchAsync';
import { ensureNonceAccount } from '../utils/blockchain/nonceUtils';
/* -------------------------------------------------------------------------- */
/*                              Nonce endpoint                                */
/* -------------------------------------------------------------------------- */

/**
 * POST /projects/:id/nonce
 *
 * Creates (or retrieves) a durable nonce account controlled by the caller's
 * wallet (fee‑payer = server).  Returns `{ noncePubkey, nonceHash }`.
 */
export const getNonceAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: projectId } = req.params;
    const { walletPubkey } = req.body;

    if (!walletPubkey) {
      return next(new AppError('walletPubkey required', 400));
    }


    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed',
    );

    let noncePubkey: PublicKey;
    let nonceHash: string;
    try {
      ({ noncePubkey, nonceHash } = await ensureNonceAccount(
        connection,
        new PublicKey(walletPubkey),
      ));
      // Found existing nonce account
      res.json({
        noncePubkey: noncePubkey.toBase58(),
        nonceHash,
      });
      return;
    } catch (e) {
      // Build a wallet-signed nonce creation tx and return 409 handshake
      const wallet = new PublicKey(walletPubkey);
      const nonceKp = Keypair.generate();
      const lamports = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

      const createIx = SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: nonceKp.publicKey,
        lamports,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      });

      const initIx = SystemProgram.nonceInitialize({
        noncePubkey: nonceKp.publicKey,
        authorizedPubkey: wallet,
      });

      const { blockhash } = await connection.getLatestBlockhash('finalized');
      const tx = new Transaction({ feePayer: wallet, recentBlockhash: blockhash })
        .add(createIx, initIx);
      tx.partialSign(nonceKp);
      const txBase64 = tx.serialize({ requireAllSignatures: false }).toString('base64');

      res.status(409).json({
        code: 'WALLET_SIGNATURE_REQUIRED',
        reason: 'CREATE_NONCE',
        noncePubkey: nonceKp.publicKey.toBase58(),
        txBase64,
        txForWallet: txBase64,
        missing: [wallet.toBase58()],
      });
      return;
    }
  } catch (err) {
    next(err);
  }
};

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

export const compileTsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tsFileName } = req.body;
    if (!tsFileName) {
      return next(new AppError('No .ts filename provided', 400));
    }

    const compileCwd = "/absolute/path/to/backend/src/data/nodes/off-chain/nft-metaplex";
    const jsContent = await compileTs(tsFileName, compileCwd, "dist");

    res.status(200).json({
      message: 'Compile & fetch success',
      jsContent,
    });
  } catch (error) {
    next(error);
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

export const buildProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id ?? 'mock-user';
  // org_id checks temporarily disabled until auth lands

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
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

    const { details: detailsStr } = projectCheck.rows[0];
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
      //console.log('Skipping build process for lite project');
      res.status(200).json({ 
        message: 'Build operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const taskId = await startAnchorBuildTask(id, userId);

    res.status(200).json({
      message: 'Anchor build process started',
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getBuildArtifact = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) return next(new AppError('User information not found', 400));

  try {
    const artifact = await getBuildArtifactTask(id);
    res.status(200).json({
      status: 'success',
      base64So: artifact.base64So,
    });
  } catch (error) {
    next(error);
  }
};

export const createEphemeralKeypair = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id;
    
    // Generate a new ephemeral keypair
    const ephem = Keypair.generate();
    const pubkey = ephem.publicKey.toBase58();
    
    // Store the keypair in memory only
    ephemeralKeys.set(pubkey, ephem);
    //console.log(`[EPHEMERAL] Generated new ephemeral keypair: ${pubkey}`);
    //console.log(`[EPHEMERAL] Total ephemeral keys now stored: ${ephemeralKeys.size}`);
   // console.log(`[EPHEMERAL] All stored keys: ${Array.from(ephemeralKeys.keys()).join(', ')}`);
    
    // Return only the public key to the client
    res.status(200).json({
      message: 'Ephemeral keypair created successfully',
      pubkey,
      ephemeralPubkey: pubkey
    });
  } catch (error) {
    console.error('Error creating ephemeral keypair:', error);
    next(new AppError('Failed to create ephemeral keypair', 500));
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

export const testProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    return next(new AppError('User information not found', 400));
  }

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2',
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

    const { details: detailsStr } = projectCheck.rows[0];
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
    //  console.log('Skipping test process for lite project');
      res.status(200).json({ 
        message: 'Test operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const taskId = await startAnchorTestTask(id, userId);

    res.status(200).json({
      message: 'Anchor test process started',
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

export const relaySignedTx = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;
  const { encodedTx, programId, serverSignFor = [], signerHint } = req.body;
  
  if (!encodedTx || !programId) {
    return next(new AppError('Missing encodedTx or programId', 400));
  }
  
  try {
    // Collect extra server-side signers (ephemeral etc.)
    const extraSigners: Keypair[] = [];

    // From explicit list
    if (Array.isArray(serverSignFor)) {
      for (const pk of serverSignFor) {
        const kp = (ephemeralKeys as Map<string, Keypair>).get(pk);
        if (kp) {
          extraSigners.push(kp);
        } else {
        }
      }
    }
    // From signer hint
    if (signerHint?.type === 'ephemeral' && signerHint?.pubkey) {
      const kp = (ephemeralKeys as Map<string, Keypair>).get(signerHint.pubkey);
      if (kp) {
        extraSigners.push(kp);
      } else {
      }
    }


    // First check if the transaction is already fully signed
    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
    const msg = transaction.compileMessage();
    const requiredSigs = msg.header.numRequiredSignatures;
    const currentSigs = transaction.signatures.filter(s => s.signature).length;
    
    
   // console.log(`[RELAY_SIGNED_TX] Checking if this is a deployment transaction...`);
    // Check if this is a BPF upgrade loader transaction - look for Write (1), Deploy (2), or Upgrade (3) instructions
    // The deployment transaction may have multiple instructions (nonce advance, create account, write, deploy)
    let isBPFLoaderTransaction = false;
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      if (instruction && instruction.data.length >= 4) {
        const instructionType = Array.from(instruction.data.slice(0, 4));
      //  console.log(`[RELAY_SIGNED_TX] Instruction ${i} data prefix: [${instructionType.join(',')}]`);
        
        // Check for Write (1) OR Deploy (2) OR Upgrade (3) instructions
        if ((instructionType[0] === 1 || instructionType[0] === 2 || instructionType[0] === 3) 
            && instructionType[1] === 0 && instructionType[2] === 0 && instructionType[3] === 0) {
       //   console.log(`[RELAY_SIGNED_TX] Found BPF loader instruction (type ${instructionType[0]}) at index ${i}`);
          isBPFLoaderTransaction = true;
          
          // For Write instructions, sign with ephemeral key
          if (instructionType[0] === 1) {
        //    console.log(`[RELAY_SIGNED_TX] This is a Write instruction - needs ephemeral signing`);
          }
        }
      }
    }
    
    if (isBPFLoaderTransaction) {
   //   console.log(`[RELAY_SIGNED_TX] This is a BPF loader transaction`);
    } else {
      console.log(`[RELAY_SIGNED_TX] This is not a BPF loader transaction`);
    }
    
    let txSignature: string;
    
    // Force server signing for BPF loader transactions even if they appear "fully signed"
    // because Write transactions need ephemeral key signatures
    if (currentSigs === requiredSigs && !isBPFLoaderTransaction) {
      // Transaction is fully signed and not a BPF loader transaction, broadcast directly
  //    console.log(`[RELAY_SIGNED_TX] Transaction is fully signed, broadcasting directly`);
      const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(endpoint, 'confirmed');
      
      txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: true }
      );
      
   //   console.log(`[RELAY_SIGNED_TX] Direct broadcast successful: ${txSignature}`);
    } else {
      // Transaction needs additional server signing (or is a BPF loader transaction)
      if (isBPFLoaderTransaction) {
 //       console.log(`[RELAY_SIGNED_TX] BPF loader transaction detected, forcing server signature processing`);
      } else {
        console.log(`[RELAY_SIGNED_TX] Transaction needs server signatures, processing...`);
      }
      
      const out = await signDeployTxAndBroadcast(id, encodedTx, programId, { extraSigners });
      if (out?.txForWallet) {
        return res.status(409).json({
          code: 'WALLET_SIGNATURE_REQUIRED',
          missing: out.missing ?? [],
          txBase64: out.txForWallet,
          txForWallet: out.txForWallet,
        });
      }
      txSignature = out.signature as string;
    }
    
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE solanaproject
           SET details     = COALESCE(details::jsonb, '{}'::jsonb) || $1::jsonb,
               last_updated = $2
         WHERE id = $3`,
        [JSON.stringify({ programId }), new Date(), id],
      );
    } finally {
      client.release();
    }
    
  //  console.log(`[RELAY_SIGNED_TX] Program ${programId} deployed successfully for project ${id}`);
    
    // Restart container so Next.js picks up the new Program ID
    const { rows: [proj] } = await pool.query(
      'SELECT container_name FROM solanaproject WHERE id = $1',
      [id]
    );
    if (proj && proj.container_name) {
      try {
        await runCommand(`docker restart ${proj.container_name}`, '.', uuidv4());
      } catch (err) {
        console.error(`[RELAY_SIGNED_TX] Failed to restart container ${proj.container_name}:`, err);
      }
    }
    
    res.status(200).json({ signature: txSignature, programId });
    return;
  } catch (error: any) {
    console.error('[RELAY_SIGNED_TX] Failed to broadcast signed transaction:', error);
    next(new AppError('Failed to relay signed transaction', 500));
    return;
  }
};

export const relayTx = async (req: Request, res: Response, next: NextFunction) => {
  const { encodedTx, programId } = req.body;
  
  if (!encodedTx || !programId) {
    return next(new AppError('Missing encodedTx or programId', 400));
  }
  
  try {
    
    const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(endpoint, 'confirmed');
    
    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
    
    if (!transaction.feePayer) {
      console.error('[RELAY_TX] ERROR: No fee payer set');
      return next(new AppError('Transaction must have a fee payer', 400));
    }
        
    if (ephemeralKeys.has(transaction.feePayer.toBase58())) {
      const balance = await connection.getBalance(transaction.feePayer, 'confirmed');
      const MIN_BALANCE = 15000; // Minimum for one transaction
      
      if (balance < MIN_BALANCE) {
        console.error(`[RELAY_TX] Ephemeral fee payer has insufficient balance: ${balance} lamports`);
        console.error(`[RELAY_TX] This indicates initial funding was too low`);
        return next(new AppError(
          `Ephemeral key has insufficient balance (${balance} lamports). ` +
          `Initial funding calculation was too low. Please restart deployment.`,
          400
        ));
      }
      
    }
    
    const msg = transaction.compileMessage();
    const requiredSigners = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
    
    const existingSigs = transaction.signatures.filter(s => s.signature).length;
    
    const signers: Keypair[] = [];
    for (const [pubkeyStr, keypair] of ephemeralKeys) {
      if (requiredSigners.some(k => k.equals(keypair.publicKey))) {
        const sigIndex = msg.accountKeys.findIndex(k => k.equals(keypair.publicKey));
        if (sigIndex >= 0 && sigIndex < transaction.signatures.length) {
          if (!transaction.signatures[sigIndex].signature) {
            signers.push(keypair);
          } else {
            console.log(`[RELAY_TX] Ephemeral key ${pubkeyStr} already signed`);
          }
        }
      }
    }
    
    if (signers.length === 0 && existingSigs < msg.header.numRequiredSignatures) {
      console.error(`[RELAY_TX] ERROR: No ephemeral keys found to complete signing`);
      console.error(`[RELAY_TX] Required signers: ${requiredSigners.map(k => k.toBase58()).join(', ')}`);
      console.error(`[RELAY_TX] Available ephemeral keys: ${Array.from(ephemeralKeys.keys()).join(', ')}`);
      return next(new AppError('No ephemeral key found to sign this transaction', 400));
    }
    
    // Sign with ephemeral keys
    for (const signer of signers) {
      transaction.partialSign(signer);
  //    console.log(`[RELAY_TX] Signed with ephemeral key: ${signer.publicKey.toBase58()}`);
    }
    
    // Verify all required signatures are present
    const finalSigs = transaction.signatures.filter(s => s.signature).length;
 //   console.log(`[RELAY_TX] Final signatures: ${finalSigs}/${msg.header.numRequiredSignatures}`);
    
    if (finalSigs < msg.header.numRequiredSignatures) {
      const missing = [];
      for (let i = 0; i < msg.header.numRequiredSignatures; i++) {
        if (!transaction.signatures[i]?.signature) {
          missing.push(msg.accountKeys[i].toBase58());
        }
      }
      console.error(`[RELAY_TX] Still missing signatures from: ${missing.join(', ')}`);
      return next(new AppError(`Missing signatures from: ${missing.join(', ')}`, 400));
    }
    
    // Send the fully signed transaction
 //   console.log(`[RELAY_TX] Sending fully signed transaction...`);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
 //   console.log(`[RELAY_TX] Transaction sent successfully: ${signature}`);
    
    // Wait for confirmation
    try {
      await connection.confirmTransaction(signature, 'confirmed');
 //     console.log(`[RELAY_TX] Transaction confirmed: ${signature}`);
    } catch (confirmError) {
      console.warn(`[RELAY_TX] Confirmation timeout (continuing): ${confirmError}`);
    }
    
    res.status(200).json({ signature });
  } catch (error: any) {
    console.error('[RELAY_TX] Error:', error.message);
    if (error.logs) {
      console.error('[RELAY_TX] Transaction logs:', error.logs);
    }
    
    if (error.message?.includes('Attempt to debit')) {
      next(new AppError('Fee payer has insufficient SOL balance', 400));
    } else if (error.message?.includes('Transaction simulation failed')) {
      next(new AppError(`Transaction simulation failed: ${error.message}`, 400));
    } else {
      next(new AppError(`Failed to relay transaction: ${error.message}`, 500));
    }
  }
};

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
 * POST /projects/:id/local-validator/deploy
 * Deploy program to local test validator (instant, no SOL required)
 */
export const deployToLocalValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { forceRebuild = false, walletPubkey } = req.body;
    
    console.log(`[LOCAL_DEPLOY] Starting local deployment for project ${projectId}`);
    console.log(`[LOCAL_DEPLOY] Force rebuild: ${forceRebuild}, Wallet: ${walletPubkey || 'none'}`);
    
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      return next(new AppError('Container not found', 404));
    }
    
    // Step 1: Ensure validator is running
    console.log('[LOCAL_DEPLOY] Checking validator status...');
    const validatorCheck = `docker exec ${containerName} /usr/local/bin/start-validator.sh status`;
    const validatorStatus = await runCommand(validatorCheck, '.', uuidv4(), { skipSuccessUpdate: true })
      .catch(() => 'not-running');
    
    if (!validatorStatus.includes('running')) {
      console.log('[LOCAL_DEPLOY] Validator not running, starting it...');
      // Start validator
      const startCmd = walletPubkey 
        ? `docker exec -e WALLET_PUBKEY=${walletPubkey} ${containerName} /usr/local/bin/start-validator.sh`
        : `docker exec ${containerName} /usr/local/bin/start-validator.sh`;
      
      await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      // Wait for validator to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Step 2: Check if program needs building
    const rootPath = await getProjectRootPath(projectId);
    const programPath = `/usr/src/${rootPath}`;
    
    // Find the program name from Anchor.toml
    const getProgramNameCmd = `docker exec ${containerName} bash -c "cd ${programPath} && grep '^\\[programs.localnet\\]' -A 1 Anchor.toml | grep -oP '^\\w+' | tail -1"`;
    const programName = (await runCommand(getProgramNameCmd, '.', uuidv4(), { skipSuccessUpdate: true }))
      .trim() || 'solanaflow';
    
    console.log(`[LOCAL_DEPLOY] Program name: ${programName}`);
    
    const soFile = `/usr/src/target/deploy/${programName}.so`;
    const keypairFile = `/usr/src/target/deploy/${programName}-keypair.json`;
    
    // Check if .so file exists or if rebuild is forced
    const soExistsCmd = `docker exec ${containerName} test -f ${soFile} && echo "exists" || echo "missing"`;
    const soExists = await runCommand(soExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    if (soExists.trim() === 'missing' || forceRebuild) {
      console.log('[LOCAL_DEPLOY] Building program...');
      
      // Fix workspace configuration before building
      const fixWorkspaceCmd = `docker exec ${containerName} bash -c "
        cd ${programPath} &&
        # Ensure Cargo.toml has correct workspace members
        if [ -f Cargo.toml ]; then
          # Check if programs directory exists
          if [ -d programs ]; then
            # Add all program directories to workspace
            for dir in programs/*/; do
              if [ -f \\"\$dir/Cargo.toml\\" ]; then
                dirname=\\$(basename \\"\$dir\\")
                if ! grep -q \\\"programs/\$dirname\\\" Cargo.toml; then
                  sed -i '/members = \\[/a\\\\    \\\"programs/'\$dirname'\\\",' Cargo.toml
                fi
              fi
            done
          fi
        fi
      "`;
      
      await runCommand(fixWorkspaceCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      console.log('[LOCAL_DEPLOY] Fixed workspace configuration');
      
      // Build the program with better error handling
      const buildCmd = `docker exec ${containerName} bash -lc "
        cd ${programPath} &&
        # Clean up any previous build artifacts
        cargo clean 2>/dev/null || true &&
        # Set proper permissions
        chmod -R 755 . &&
        # Build with verbose output
        anchor build --verifiable 2>&1
      "`;
      
      let buildOutput: string;
      try {
        buildOutput = await runCommand(buildCmd, '.', projectId);
      } catch (buildError: any) {
        console.error('[LOCAL_DEPLOY] Build command failed:', buildError);
        // Extract meaningful error from output
        const errorMsg = buildError.message || buildError.toString();
        const relevantError = errorMsg.split('\n').find((line: string) => 
          line.includes('error') || line.includes('Error') || line.includes('failed')
        ) || errorMsg.substring(0, 500);
        throw new Error(`Build failed: ${relevantError}`);
      }
      
      // Check for success indicators
      if (!buildOutput.includes('Finished') && 
          !buildOutput.includes('success') && 
          !buildOutput.includes('Program Id:')) {
        // Extract the actual error from build output
        const lines = buildOutput.split('\n');
        const errorLine = lines.find(line => 
          line.includes('error:') || line.includes('Error:')
        ) || 'Unknown build error';
        throw new Error(`Build failed: ${errorLine}`);
      }
      
      console.log('[LOCAL_DEPLOY] Build completed successfully');
    } else {
      console.log('[LOCAL_DEPLOY] Using existing build artifact');
    }
    
    // Step 3: Get or generate program keypair
    let programId: string;
    
    const keypairExistsCmd = `docker exec ${containerName} test -f ${keypairFile} && echo "exists" || echo "missing"`;
    const keypairExists = await runCommand(keypairExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    if (keypairExists.trim() === 'exists') {
      // Get existing program ID
      const getProgramIdCmd = `docker exec ${containerName} solana-keygen pubkey ${keypairFile}`;
      programId = (await runCommand(getProgramIdCmd, '.', uuidv4(), { skipSuccessUpdate: true })).trim();
      console.log(`[LOCAL_DEPLOY] Using existing program ID: ${programId}`);
    } else {
      // Generate new keypair
      console.log('[LOCAL_DEPLOY] Generating new program keypair...');
      const genKeypairCmd = `docker exec ${containerName} solana-keygen new --outfile ${keypairFile} --no-bip39-passphrase --force`;
      await runCommand(genKeypairCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      const getProgramIdCmd = `docker exec ${containerName} solana-keygen pubkey ${keypairFile}`;
      programId = (await runCommand(getProgramIdCmd, '.', uuidv4(), { skipSuccessUpdate: true })).trim();
      console.log(`[LOCAL_DEPLOY] Generated new program ID: ${programId}`);
    }
    
    // Step 4: Configure Solana CLI for local validator
    console.log('[LOCAL_DEPLOY] Configuring Solana CLI for local validator...');
    const configCmd = `docker exec ${containerName} bash -c "
      solana config set --url http://localhost:8899 &&
      solana config set --commitment confirmed
    "`;
    await runCommand(configCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Step 5: Check if program is already deployed
    const checkDeployedCmd = `docker exec ${containerName} bash -c "
      solana program show ${programId} --url http://localhost:8899 2>&1 || echo 'not-found'
    "`;
    const deployedCheck = await runCommand(checkDeployedCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    let deploymentType: 'new' | 'upgrade' = 'new';
    if (!deployedCheck.includes('not-found') && !deployedCheck.includes('AccountNotFound')) {
      deploymentType = 'upgrade';
      console.log('[LOCAL_DEPLOY] Program already deployed, will upgrade');
    } else {
      console.log('[LOCAL_DEPLOY] Program not deployed, will do initial deployment');
    }
    
    // Step 6: Deploy or upgrade the program
    console.log(`[LOCAL_DEPLOY] Starting ${deploymentType} deployment...`);
    
    let deployOutput: string;
    
    if (deploymentType === 'new') {
      // Initial deployment using anchor deploy
      const deployCmd = `docker exec ${containerName} bash -lc "
        cd ${programPath} &&
        anchor deploy --provider.cluster localnet --program-keypair ${keypairFile}
      "`;
      
      deployOutput = await runCommand(deployCmd, '.', projectId);
    } else {
      // Upgrade using solana program deploy
      const upgradeCmd = `docker exec ${containerName} bash -c "
        solana program deploy ${soFile} \\
          --program-id ${keypairFile} \\
          --url http://localhost:8899 \\
          --commitment confirmed
      "`;
      
      deployOutput = await runCommand(upgradeCmd, '.', projectId);
    }
    
    // Step 7: Verify deployment
    const verifyCmd = `docker exec ${containerName} bash -c "
      solana program show ${programId} --url http://localhost:8899 | head -5
    "`;
    const verifyOutput = await runCommand(verifyCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    if (!verifyOutput.includes(programId)) {
      throw new Error('Deployment verification failed');
    }
    
    // Step 8: Update IDL (if it exists)
    const idlPath = `/usr/src/target/idl/${programName}.json`;
    const idlExistsCmd = `docker exec ${containerName} test -f ${idlPath} && echo "exists" || echo "missing"`;
    const idlExists = await runCommand(idlExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    let idlContent = null;
    if (idlExists.trim() === 'exists') {
      console.log('[LOCAL_DEPLOY] Uploading IDL...');
      
      try {
        // Initialize or upgrade IDL
        const idlCmd = `docker exec ${containerName} bash -lc "
          cd ${programPath} &&
          (anchor idl init -f ${idlPath} ${programId} --provider.cluster localnet ||
           anchor idl upgrade -f ${idlPath} ${programId} --provider.cluster localnet)
        "`;
        
        await runCommand(idlCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        
        // Read IDL content
        const readIdlCmd = `docker exec ${containerName} cat ${idlPath}`;
        idlContent = await runCommand(readIdlCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      } catch (idlError) {
        console.warn('[LOCAL_DEPLOY] IDL upload failed (non-critical):', idlError);
      }
    }
    
    // Step 9: Update project details with local deployment info
    await pool.query(
      `UPDATE solanaproject 
       SET details = jsonb_set(
         jsonb_set(
           COALESCE(details, '{}'::jsonb),
           '{localDeployment}',
           $1::jsonb
         ),
         '{localProgramId}',
         to_jsonb($2::text)
       )
       WHERE id = $3`,
      [
        JSON.stringify({
          deployedAt: new Date().toISOString(),
          programName,
          deploymentType,
          validatorUrl: 'http://localhost:8899'
        }),
        programId,
        projectId
      ]
    );
    
    // Step 10: Write program ID to .env for frontend
    const envCmd = `docker exec ${containerName} bash -c "
      echo 'NEXT_PUBLIC_PROGRAM_ID=${programId}' > ${programPath}/web/.env.local &&
      echo 'NEXT_PUBLIC_CLUSTER=custom' >> ${programPath}/web/.env.local &&
      echo 'NEXT_PUBLIC_RPC_URL=http://localhost:8899' >> ${programPath}/web/.env.local
    "`;
    await runCommand(envCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    // Restart Next.js to pick up new env vars
    const restartNextCmd = `docker exec ${containerName} bash -c "
      pkill -f 'next dev' || true &&
      cd ${programPath}/web &&
      nohup npm run dev > /tmp/next.log 2>&1 &
    "`;
    await runCommand(restartNextCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    console.log(`[LOCAL_DEPLOY] Deployment successful! Program ID: ${programId}`);
    
    res.json({
      message: `Program ${deploymentType === 'new' ? 'deployed' : 'upgraded'} successfully to local validator`,
      programId,
      programName,
      deploymentType,
      rpcUrl: 'http://localhost:8899',
      websocketUrl: 'ws://localhost:8900',
      faucetUrl: 'http://localhost:9900',
      idl: idlContent ? JSON.parse(idlContent) : null,
      deployOutput: deployOutput.substring(0, 1000) // First 1000 chars for debugging
    });
    
  } catch (error) {
    console.error('[LOCAL_DEPLOY] Deployment error:', error);
    next(new AppError(`Local deployment failed: ${(error as Error).message}`, 500));
  }
};

/**
 * POST /projects/:id/local-validator/quick-deploy
 * One-click local deployment with automatic setup
 */
export const quickDeployLocal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { walletPubkey, resetValidator = false } = req.body;
    
    console.log(`[QUICK_DEPLOY] Starting quick local deployment for project ${projectId}`);
    
    // Step 1: Start or reset validator
    const startValidatorReq = {
      params: { id: projectId },
      body: { reset: resetValidator, walletPubkey },
      user: req.user
    } as unknown as Request;
    
    await new Promise((resolve, reject) => {
      startLocalValidator(startValidatorReq, {
        json: resolve,
        status: () => ({ json: resolve })
      } as any, reject);
    });
    
    // Wait for validator to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 1.5: Fix workspace issues before deployment
    const containerName = await getContainerName(projectId);
    if (containerName) {
      console.log('[QUICK_DEPLOY] Checking and fixing workspace configuration...');
      const rootPath = await getProjectRootPath(projectId);
      const fixCmd = `docker exec ${containerName} bash -c "
        cd /usr/src/${rootPath} &&
        # Ensure all programs are in workspace
        find programs -name 'Cargo.toml' -type f 2>/dev/null | while read prog; do
          dir=\\$(dirname \\$prog)
          if ! grep -q \\\"\\$dir\\\" Cargo.toml 2>/dev/null; then
            sed -i '/members = \\[/a\\\\    \\\"'\\$dir'\\\",' Cargo.toml
          fi
        done
      "`;
      await runCommand(fixCmd, '.', uuidv4(), { skipSuccessUpdate: true })
        .catch(err => console.warn('[QUICK_DEPLOY] Workspace fix warning:', err));
    }
    
    // Step 2: Deploy to local validator with retry logic
    let deployResult: any;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        const deployReq = {
          params: { id: projectId },
          body: { walletPubkey, forceRebuild: retryCount > 0 }, // Force rebuild on retry
          user: req.user
        } as unknown as Request;
        
        deployResult = await new Promise<any>((resolve, reject) => {
          deployToLocalValidator(deployReq, {
            json: resolve,
            status: () => ({ json: resolve })
          } as any, reject);
        });
        
        break; // Success, exit retry loop
      } catch (deployError: any) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw deployError;
        }
        console.log(`[QUICK_DEPLOY] Retry ${retryCount}/${maxRetries} after error:`, deployError.message);
        
        // Clean workspace before retry
        if (containerName) {
          const rootPath = await getProjectRootPath(projectId);
          await runCommand(
            `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && cargo clean"`,
            '.', uuidv4(), { skipSuccessUpdate: true }
          ).catch(() => {}); // Ignore clean errors
        }
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    res.json({
      message: 'Quick local deployment completed',
      ...deployResult,
      validatorReset: resetValidator
    });
    
  } catch (error) {
    console.error('[QUICK_DEPLOY] Error:', error);
    next(new AppError(`Quick deployment failed: ${(error as Error).message}`, 500));
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