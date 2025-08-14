import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getProjectRootPath } from '../utils/fileUtils';
import { startProjectContainer } from '../utils/container';
import { normalizeProjectName } from '../utils/stringUtils';
import {
  startAnchorBuildTask,
  startAnchorDeployTask,
  startAnchorInitTask,
  startAnchorTestTask,
  startCustomCommandTask,
  startInstallPackagesTask,
  getBuildArtifactTask,
  startSetClusterTask,
  runCommand,
  startInstallNodeDependenciesTask,
  compileTs,
  broadcastSignedTx,
  signDeployTxAndBroadcast,
  getContainerName,
} from '../utils/projectUtils';
import path from 'path';
import { APP_CONFIG } from '../config/appConfig';
import { Buffer } from 'buffer';
import fs from 'fs';
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

import { waitForTaskCompletion, updateTaskStatus } from '../utils/taskUtils';
import { createProject as createProjectDb } from '../utils/project/createProject';
import { catchAsync } from '../utils/catchAsync';
import { ensureNonceAccount } from '../utils/nonceUtils';
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

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description } = req.body;
    const details = req.body.details ?? {};
    const safeName = (name && name.trim()) ? name : `Untitled-${new Date().toISOString().slice(0,10)}`;

    const project = await createProjectDb({ 
      name: safeName, 
      description, 
      details 
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (err) {
    next(err);
  }
};

/* Removed createProjectDirectory - functionality no longer needed
export const createProjectDirectory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user?.id;
  // org_id checks temporarily disabled until auth lands

  try {
    const { name, description, projectId = '' } = req.body;
    
    if (!name) {
      return next(new AppError('Project name is required', 400));
    }

    const normalizedName = normalizeProjectName(name);
    const randomSuffix = uuidv4().slice(0, 8);
    const root_path = `${normalizedName}-${randomSuffix}`;
    
    if (projectId) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT id FROM solanaproject WHERE id = $1',
          [projectId]
        );
        
        if (result.rows.length === 0) {
          return next(new AppError('Project ID not found', 404));
        }
      } finally {
        client.release();
      }
    }
    
    res.status(200).json({
      message: 'Project directory creation is no longer required',
      rootPath: root_path,
      taskId: null
    });
  } catch (error) {
    console.error('Error in createProjectDirectory:', error);
    return next(new AppError('Failed to start project directory creation', 500));
  }
};
*/

export const editProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { name, description, details } = req.body;
  const userId = req.user?.id;
  // org_id checks temporarily disabled until auth lands

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectCheck = await client.query(
      'SELECT * FROM solanaproject WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      throw new AppError(
        'Project not found or you do not have permission to edit it',
        404
      );
    }

    let updateQuery = 'UPDATE solanaproject SET last_updated = NOW()';
    const updateValues = [];
    let valueIndex = 1;

    if (name !== undefined) {
      updateQuery += `, name = $${valueIndex}`;
      updateValues.push(name);
      valueIndex++;
    }

    if (description !== undefined) {
      updateQuery += `, description = $${valueIndex}`;
      updateValues.push(description);
      valueIndex++;
    }

    if (details !== undefined) {
      /* single pass-through for details updates (built/deployed/programId) */
      let detailsQuery = `COALESCE(details, '{}'::jsonb)`;
      if (details.projectState?.built !== undefined) {
        detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,built}', to_jsonb(($${valueIndex})::boolean), true)`;
        updateValues.push(!!details.projectState.built); valueIndex++;
      }
      if (details.projectState?.deployed !== undefined) {
        detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,deployed}', to_jsonb(($${valueIndex})::boolean), true)`;
        updateValues.push(!!details.projectState.deployed); valueIndex++;
      }
      if (details.programId !== undefined) {
        detailsQuery = `jsonb_set(${detailsQuery}, '{projectState,programId}', to_jsonb($${valueIndex}), true)`;
        updateValues.push(details.programId); valueIndex++;
      }
      updateQuery += `, details = ${detailsQuery}`;
    }

    updateQuery += ` WHERE id = $${valueIndex} RETURNING *`;
    updateValues.push(id);

    const result = await client.query(updateQuery, updateValues);

    await client.query('COMMIT');

    const updatedProject = result.rows[0];
    res.status(200).json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in editProject:', error);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to update project', 500));
    }
  } finally {
    client.release();
  }
};

export const getProjectDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  // org_id checks temporarily disabled until auth lands


  try {
    const projectResult = await pool.query(
      `
      SELECT id, name, description, root_path, details, container_url, last_updated, created_at
      FROM solanaproject
      WHERE id = $1
    `,
      [id]
    );

    if (projectResult.rows.length === 0) {
      next(
        new AppError('Project not found or you do not have permission to access it', 404)
      );
      return;
    }

    const project = projectResult.rows[0];

    const projectContext = {
      id: project.id,
      name: project.name,
      description: project.description,
      rootPath: project.root_path || '',
      details: project.details || {},
      containerUrl: project.container_url || "",
    };
    

    res.status(200).json({
      message: 'Project details retrieved successfully',
      project: projectContext,
    });
  } catch (error) {
    console.error('Error in getProjectDetails:', error);
    next(error);
  }
};

export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;

  try {
    // 1) fetch container name *before* we delete the project
    const { rows } = await pool.query(
      `SELECT container_name FROM solanaproject WHERE id = $1`,
      [id]
    );
    const container = rows[0]?.container_name;

    // 2) delete the project row
    const { rowCount } = await pool.query(
      `DELETE FROM solanaproject WHERE id = $1`,
      [id]
    );
    if (rowCount === 0) return next(new AppError('Not found', 404));

    // 3) queue container for cleanup (if we had one)
    if (container) {
      await pool.query(
        `INSERT INTO cleanup_queue (container_name, project_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [container, id]
      );
    }

    res.status(204).end();
  } catch (err) {
    next(err);
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
      console.log('Skipping Anchor initialization for lite project');
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
      console.log('Skipping build process for lite project');
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
    console.log(`[EPHEMERAL] Generated new ephemeral keypair: ${pubkey}`);
    
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

export const deployProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { walletPubkey, bufferAuthority }  = req.body;
    
    console.log(`[DEPLOY] Starting deployment for project ${projectId} with wallet ${walletPubkey}`);
    
    // Get the buffer authority keypair from memory
    const bufferAuthorityKp = ephemeralKeys.get(bufferAuthority);
    if (!walletPubkey || !bufferAuthorityKp) {
      return next(new AppError('walletPubkey or bufferAuthority missing', 400));
    }

    /* ① fetch artefact (base‑64) and secret key */
    console.log(`[DEPLOY] Fetching build artifact for project ${projectId}`);
    const { base64So } = await getBuildArtifactTask(projectId);           // 259 kB string
    console.log(`[DEPLOY] Retrieved build artifact, size: ${base64So.length} characters`);
    
    const soBytes = Uint8Array.from(atob(base64So), c => c.charCodeAt(0)).buffer;
    console.log(`[DEPLOY] Converted base64 to binary, size: ${soBytes.byteLength} bytes`);

    /* ② pull existing program context (if any) -------------------------- */
    const detailsRes = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
      [projectId],
    );
    let existingProgramIdStr: string | undefined;
    if (detailsRes.rows.length) {
      const d =
        typeof detailsRes.rows[0].details === 'object'
          ? detailsRes.rows[0].details
          : JSON.parse(detailsRes.rows[0].details || '{}');
      existingProgramIdStr =
        d?.programId ?? d?.projectState?.programId ?? d?.lastProgramId;
    }

    const programKeypair = await loadProgramKeypair(projectId);

    /* ③ run deployWithEphemeralKey on the server ------------------------ */
    const endpoint = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    console.log(`[DEPLOY] Using RPC endpoint: ${endpoint}`);
    
    const connection = new Connection(endpoint, 'confirmed');
    // Use buffer-authority as fee-payer (wallet already funded it)
    const feePayer = bufferAuthorityKp;
    console.log(`[DEPLOY] Using buffer‑authority as fee‑payer: ${feePayer.publicKey.toBase58()}`);

    /* ----------------------------------------------------------------- */
    /* REAL DEPLOY 🥳 – uses the upgradeable loader (same path as CLI)   */
    /* ----------------------------------------------------------------- */
    const finalProgramKp = programKeypair ?? Keypair.generate();

    // Decide: new deploy or upgrade based on whether the program already exists
    const existing = await connection.getAccountInfo(finalProgramKp.publicKey, 'confirmed');

    // Convert walletPubkey string to PublicKey object for the deploy function
    const walletPublicKey = new PublicKey(walletPubkey);
    
    // Back‑end performs full deploy/upgrade + authority transfer
    try {
      // Create a signAndSend function that signs with the buffer authority keypair
      const signAndSend = async (tx: Transaction, signers?: Keypair[]): Promise<string> => {
        const allSigners = [feePayer, ...(signers || [])];
        return await connection.sendTransaction(tx, allSigners, { skipPreflight: true });
      };
      
      // Use the proven implementation with correct authority handling
      const programId = await deployOrUpgradeUpgradeable(
        connection,
        walletPublicKey,
        signAndSend,
        Buffer.from(soBytes),
        'delegated'
      );
      
      // Store the returned programId for later use
      const programIdPubkey = programId;
    } catch (err) {
      if (err instanceof SendTransactionError) {
        // Get logs from the error object
        const logs = err.logs || [];
        console.error('SendTransactionError logs:', logs);
      }
      throw err;
    }
    
    // Clean up the ephemeral key from memory
    ephemeralKeys.delete(bufferAuthority);

    // Use the keypair's public key as the real programId
    const programIdPubkey = finalProgramKp.publicKey;  // PublicKey
    const programId = programIdPubkey.toBase58();      // string for DB/logs

    /* Persist newly‑generated key so future upgrades reuse it */
    if (!programKeypair) {
      const kpPath = path.join(
        APP_CONFIG.WALLETS_FOLDER,
        `${programId}.json`,
      );
      fs.writeFileSync(kpPath, JSON.stringify(Array.from(finalProgramKp.secretKey)));
      console.log(`[DEPLOY] Saved program keypair → ${kpPath}`);
    }

    // store real programId in project.details
    await pool.query(
      `UPDATE solanaproject
         SET details     = COALESCE(details::jsonb,'{}'::jsonb) || $1::jsonb,
             last_updated = NOW()
       WHERE id = $2`,
      [JSON.stringify({ programId }), projectId]
    );

    console.log(`[DEPLOY] Deployment completed successfully for project ${projectId}`);
    console.log(`[DEPLOY] Program ID: ${programId}`);
    
    res.json({
      success: true,
      programId
    });
  } catch (err: any) {
    console.error('[deployProject] failed:', err);
    next(new AppError(err.message ?? 'deploy failed', 500));
  }
};

export const deployProjectEphemeral = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  /** 
   * ⚠️  dev-only: we don't run auth yet.
   *     fall back to a deterministic mock user ID if none supplied.
   */
  const userId = req.user?.id ?? 'mock-user';
  const { ephemeralPubkey } = req.body;

  console.log(`[DEPLOY_EPHEMERAL] Received request to deploy project ${id} with ephemeral key ${ephemeralPubkey}`);

  if (!ephemeralPubkey) {
    console.log(`[DEPLOY_EPHEMERAL] No ephemeral public key provided in request`);
    return next(new AppError('Ephemeral public key is required', 400));
  }

  // If using Phantom (signed transaction path), skip container deploy and await relay
  if (ephemeralPubkey === 'SIGNED') {
    console.log(`[DEPLOY_EPHEMERAL] 'SIGNED' flag received – expecting front-end to handle deployment`);
    // Generate a new program keypair for this deploy
    const program = Keypair.generate();
    const pubkey = program.publicKey.toBase58();
    // Persist the secret (e.g., store in AWS Secrets Manager or an encrypted file)
    const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${pubkey}.json`);
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(program.secretKey)));
    const taskId = await startAnchorDeployTask(id, userId, 'SIGNED');
    res.status(200).json({
      message: 'Awaiting signed transaction from wallet',
      taskId: taskId,
      programId: pubkey
    });
    return;
  }
  
  // Validate the ephemeral key format for provided pubkey
  try {
    console.log(`[DEPLOY_EPHEMERAL] Validating ephemeral key format`);
    // Check if the key is in the expected format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ephemeralPubkey)) {
      console.log(`[DEPLOY_EPHEMERAL] Invalid ephemeral key format: ${ephemeralPubkey}`);
      return next(new AppError('Invalid ephemeral public key format', 400));
    }

    // Check if the key file exists
    const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
    if (!fs.existsSync(walletPath)) {
      console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file not found at ${walletPath}`);
      return next(new AppError(`Ephemeral key file not found. Please create it first.`, 404));
    }
    console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file exists at ${walletPath}`);
  } catch (validationError: any) {
    console.error(`[DEPLOY_EPHEMERAL] Error validating ephemeral key:`, validationError);
    return next(new AppError(`Error validating ephemeral key: ${validationError.message}`, 400));
  }

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      console.log(`[DEPLOY_EPHEMERAL] Project not found (id=${id})`);
      return next(
        new AppError(
          'Project not found or you do not have permission to deploy it',
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
    } catch (err: any) {
      console.error('[DEPLOY_EPHEMERAL] Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    console.log(`[DEPLOY_EPHEMERAL] Starting anchor deploy task with ephemeral key ${ephemeralPubkey}`);
    const taskId = await startAnchorDeployTask(id, userId, ephemeralPubkey);
    console.log(`[DEPLOY_EPHEMERAL] Deploy task started: ${taskId}`);

    // Wait for the task to complete (up to 120s)
      console.log(`[DEPLOY_EPHEMERAL] Waiting for task ${taskId} to complete...`);
    const status = await waitForTaskCompletion(taskId, 120000);
      console.log(`[DEPLOY_EPHEMERAL] Task ${taskId} completed with status: ${status}`);
      
      if (status === 'succeed' || status === 'finished') {
      // Retrieve the programId from the task result
        const client = await pool.connect();
            let programId: string | null = null;
            try {
        const taskRes = await client.query('SELECT result FROM task WHERE id = $1', [taskId]);
        if (taskRes.rows.length && taskRes.rows[0].result) {
          try {
            const resultObj = JSON.parse(taskRes.rows[0].result);
            programId = resultObj.programId ?? null;
            } catch (e) {
            console.error('[DEPLOY_EPHEMERAL] Error parsing task result JSON:', e);
            }
            if (programId) {
            // Ensure programId is stored in project details (in case not already updated)
              await client.query(
                `UPDATE solanaproject
                 SET details = COALESCE(details::jsonb, '{}'::jsonb) || $1::jsonb,
                       last_updated = $2
                 WHERE id = $3`,
              [JSON.stringify({ programId }), new Date(), id]
            );
            console.log(`[DEPLOY_EPHEMERAL] Program ID ${programId} stored in DB.`);
            }
          }
        } finally {
          client.release();
        }
      if (programId) {
        console.log(`[DEPLOY_EPHEMERAL] Deployment succeeded with Program ID: ${programId}`);
        res.status(200).json({ success: true, programId, signatures: [] });
        return;
      } else {
        console.log(`[DEPLOY_EPHEMERAL] Task succeeded but no Program ID found.`);
        next(new AppError('Deployment finished but Program ID not found in result', 500));
        return;
      }
      } else if (status === 'failed') {
      console.warn(`[DEPLOY_EPHEMERAL] Deployment task failed.`);
      res.status(200).json({ success: false, error: 'Program deployment failed', programId: null, signatures: [] });
      return;
      } else if (status === 'timeout') {
      console.warn(`[DEPLOY_EPHEMERAL] Deployment task timed out.`);
      res.status(200).json({ success: false, error: 'Deployment timed out', programId: null, signatures: [] });
      return;
    } else {
      // Should not happen (covers any other status)
      res.status(200).json({ success: false, error: `Deployment ended with status: ${status}`, programId: null, signatures: [] });
      return;
    }
  } catch (error: any) {
    console.error('[DEPLOY_EPHEMERAL] Error in deployProjectEphemeral:', error);
    return next(new AppError('Ephemeral deployment process failed', 500));
  }
};

/** GET /projects/:id/program-keypair — was leaking secret. Removed. */

/**
 * GET /projects/:id/program-id
 * Returns only the public program ID for a project.
 */
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
      console.log('Skipping test process for lite project');
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
      console.log(`Executing function ${functionName} with parameters:`, parameters);
      console.log(`UMI required: ${requiresUmi}`);
      
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

// --- LIST PROJECTS WITH OPTIONAL SEARCH & PAGINATION ------------------
export const listProjects = async (
  req: Request, res: Response, next: NextFunction
) => {
  const page   = Number(req.query.page  ?? 1);
  const limit  = Number(req.query.limit ?? 10);
  const search = String(req.query.search ?? '').trim();

  const offset = (page - 1) * limit;
  const params: any[] = [limit, offset];
  const whereSQL =
    search
      ? `WHERE name ILIKE $3 OR description ILIKE $3`
      : '';

  if (search) params.push(`%${search}%`);

  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, container_url AS "containerUrl", details
         FROM solanaproject
         ${whereSQL}
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
      params
    );

    const totalQ = await pool.query(
      `SELECT COUNT(*) FROM solanaproject ${whereSQL}`,
      search ? [`%${search}%`] : []
    );

    res.json({
      data: rows,
      totalPages: Math.ceil(Number(totalQ.rows[0].count) / limit),
    });
  } catch (err) {
    next(err);
  }
};

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
    
    
    console.log(`[RELAY_SIGNED_TX] Checking if this is a deployment transaction...`);
    // Check if this is a BPF upgrade loader deployment - look for instruction with [2,0,0,0] prefix
    // The deployment transaction may have multiple instructions (nonce advance, create account, deploy)
    let deployInstructionFound = false;
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      if (instruction && instruction.data.length >= 4) {
        const instructionType = Array.from(instruction.data.slice(0, 4));
        console.log(`[RELAY_SIGNED_TX] Instruction ${i} data prefix: [${instructionType.join(',')}]`);
        if (instructionType[0] === 2 && instructionType[1] === 0 && instructionType[2] === 0 && instructionType[3] === 0) {
          console.log(`[RELAY_SIGNED_TX] Found BPF loader deployment instruction at index ${i}`);
          deployInstructionFound = true;
        }
      }
    }
    
    if (deployInstructionFound) {
      console.log(`[RELAY_SIGNED_TX] This is a BPF loader deployment transaction`);
    } else {
      console.log(`[RELAY_SIGNED_TX] This is not a BPF loader deployment transaction`);
    }
    
    let txSignature: string;
    
    if (currentSigs === requiredSigs) {
      // Transaction is fully signed, broadcast directly
      console.log(`[RELAY_SIGNED_TX] Transaction is fully signed, broadcasting directly`);
      const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(endpoint, 'confirmed');
      
      txSignature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: true }
      );
      
      console.log(`[RELAY_SIGNED_TX] Direct broadcast successful: ${txSignature}`);
    } else {
      // Transaction needs additional server signing
      console.log(`[RELAY_SIGNED_TX] Transaction needs server signatures, processing...`);
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
    
    console.log(`[RELAY_SIGNED_TX] Program ${programId} deployed successfully for project ${id}`);
    
    // Restart container so Next.js picks up the new Program ID
    const { rows: [proj] } = await pool.query(
      'SELECT container_name FROM solanaproject WHERE id = $1',
      [id]
    );
    if (proj && proj.container_name) {
      try {
        await runCommand(`docker restart ${proj.container_name}`, '.', uuidv4());
        console.log(`[RELAY_SIGNED_TX] Restarted container ${proj.container_name} to load new Program ID`);
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
    
    // This is for unsigned write transactions that should be signed by ephemeral key
    const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(endpoint, 'confirmed');
    
    // Decode the transaction to inspect it
    const raw = Buffer.from(encodedTx, 'base64');
    const transaction = Transaction.from(raw);
    
    // Find ephemeral key that should sign this transaction
    let ephemeralKeypair: Keypair | null = null;
    for (const [pubkeyStr, keypair] of ephemeralKeys) {
      const msg = transaction.compileMessage();
      const signerKeys = msg.accountKeys.slice(0, msg.header.numRequiredSignatures);
      if (signerKeys.some(k => k.equals(keypair.publicKey))) {
        ephemeralKeypair = keypair;
        break;
      }
    }
    
    if (!ephemeralKeypair) {
      return next(new AppError('No ephemeral key found to sign this transaction', 400));
    }
    
    // Sign with the ephemeral key
    transaction.sign(ephemeralKeypair);
    
    // Send the transaction
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: true }
    );
    
    // Don't wait for confirmation for write transactions to avoid timeout
    
    res.status(200).json({ signature });
  } catch (error: any) {
    console.error('Relay transaction error:', error);
    next(new AppError('Failed to relay transaction', 500));
  }
};

export const relaySignedTxHandler = catchAsync(relaySignedTx);