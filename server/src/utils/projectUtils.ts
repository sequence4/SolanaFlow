import fs from 'fs';
import { APP_CONFIG } from '../config/appConfig';
import { createTask, updateTaskStatus } from './taskUtils';
import { exec, execSync, ExecException } from 'child_process';
import path from 'path';
import { getProjectRootPath } from './fileUtils';
import { v4 as uuidv4 } from 'uuid';
import { normalizeProjectName } from './stringUtils';
import pool from 'src/config/database';
import { pruneContainerResources } from './container/pruneContainer';
import { startProjectContainer } from './container/startProjectContainer';
import { Connection, sendAndConfirmRawTransaction, Transaction, Keypair } from '@solana/web3.js';
import { spawn, SpawnOptions } from 'child_process';
import { getProgramSecret, awsSecretsEnabled } from './awsSecrets';

//const USER_WORKSPACE_IMAGE = "ghcr.io/sequence4/solanaflow:latest";

function hasWarning(output: string): boolean {
  const lowercasedOutput = output.toLowerCase();
  
  if (lowercasedOutput.includes('no lockfile found') ||
      lowercasedOutput.includes('info no lockfile found')) {
    return false;
  }
  
  if (lowercasedOutput.includes('npm deprecated') && 
      lowercasedOutput.includes('this is not a bug in npm')) {
    return false;
  }
  
  return lowercasedOutput.includes('warning');
}

async function getContainerHostPort(containerName: string, containerPort = 3000, taskId: string): Promise<string> {
  try {
    const portCmd = `docker port ${containerName} ${containerPort}/tcp`;
    // Get the port mapping which looks like "0.0.0.0:randomPort"
    const portMapping = await runCommand(portCmd, '.', taskId, { skipSuccessUpdate: true });
    const portMatch = portMapping.trim().match(/:(\d+)$/);
    
    if (!portMatch) {
      console.error(`Could not parse host port from Docker output: ${portMapping}`);
      throw new Error(`Failed to get host port for container ${containerName}`);
    }
    
    return portMatch[1]; // Return the port number as a string
  } catch (error: any) {
    console.error(`Error getting container host port: ${error.message}`);
    throw error;
  }
}

export async function runCommand(
  command: string,
  cwd: string,
  taskId: string,
  options: { skipSuccessUpdate?: boolean, ensureDir?: string } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.ensureDir) {
      try {
        const mkdirCmd = `mkdir -p "${options.ensureDir}"`;
        console.log(`[DEBUG_DIR] Creating directory: ${options.ensureDir}`);
        execSync(mkdirCmd, { stdio: 'pipe' });
      } catch (dirError) {
        console.error(`[DEBUG_DIR] Error creating directory ${options.ensureDir}:`, dirError);
      }
    }

    exec(
      command,
      { cwd },
      async (error: ExecException | null, stdout: string, stderr: string) => {
        let result = '';

        console.log('!COMMAND:', command);
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);

        if (error) {
          result = `Error: ${error.message}\n\nStdout: ${stdout}\n\nStderr: ${stderr}`;
          await updateTaskStatus(taskId, 'failed', result);
          return reject(new Error(result));
        }

        if (!options.skipSuccessUpdate) {
          if (hasWarning(stdout) || (stderr && hasWarning(stderr))) {
            result = `Warning detected:\n\nStdout: ${stdout.trim()}\n\nStderr: ${stderr.trim()}`;
            await updateTaskStatus(taskId, 'warning', result);
          } else {
            result = `Success`;
            await updateTaskStatus(taskId, 'succeed', result);
          }
        }

        resolve(stdout.trim());
      }
    );
  });
};

export async function runSpawn(
  command: string,
  cwd: string,
  taskId: string,
  options: { skipSuccessUpdate?: boolean; sendProgress?: (data: unknown) => void } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    let stdoutData = '';
    let stderrData = '';
    
    /* ----- debounce helper ----- */
    let lastFlush = 0;
    const FLUSH_MS = Number(process.env.SPAWN_FLUSH_MS) || 750;
    const flushIfDue = async () => {
      const now = Date.now();
      if (now - lastFlush > FLUSH_MS) {
        lastFlush = now;
        await updateTaskStatus(taskId, 'doing', stdoutData + stderrData).catch(console.error);
      }
    };
    
    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdoutData += text;
      flushIfDue();
      if (options.sendProgress) {
        options.sendProgress({ message: text });
      }
    });
    
    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderrData += text;
      flushIfDue();
      if (options.sendProgress) {
        options.sendProgress({ message: text });
      }
    });
    
    child.on('error', error => {
      const result = `Error starting process: ${error.message}`;
      updateTaskStatus(taskId, 'failed', result).catch(console.error);
      reject(new Error(result));
    });
    
    child.on('close', async code => {
      if (code !== 0) {
        const result = `Error: process exited with code ${code}\n\nStdout: ${stdoutData}\n\nStderr: ${stderrData}`;
        await updateTaskStatus(taskId, 'failed', result);
        return reject(new Error(result));
      }
      
      // Final flush to ensure latest content is saved
      await updateTaskStatus(taskId, 'doing', stdoutData + stderrData).catch(console.error);
      
      if (!options.skipSuccessUpdate) {
        if (hasWarning(stdoutData) || hasWarning(stderrData)) {
          const result = `Warning detected:\n\nStdout: ${stdoutData.trim()}\n\nStderr: ${stderrData.trim()}`;
          await updateTaskStatus(taskId, 'warning', result);
        } else {
          await updateTaskStatus(taskId, 'succeed', 'Success');
        }
      }
      resolve(stdoutData.trim());
    });
  });
}

export async function compileTs(
  tsFileName: string,
  compileCwd: string,
  distFolder = "dist"
): Promise<string> {
  const taskId = uuidv4();

  const compileCmd = `npx tsc ${tsFileName} --outDir ${distFolder} --module commonjs --target ES2020 --esModuleInterop`;

  const compileOutput = await runCommand(compileCmd, compileCwd, taskId);
  console.log("Compile output:", compileOutput);

  const baseName = path.basename(tsFileName, ".ts");
  const jsFileName = baseName + ".js";

  const jsFilePath = path.join(compileCwd, distFolder, jsFileName);

  if (!fs.existsSync(jsFilePath)) {
    const msg = `Compiled file not found at: ${jsFilePath}`;
    await updateTaskStatus(taskId, 'failed', msg);
    throw new Error(msg);
  }

  const compiledJs = fs.readFileSync(jsFilePath, "utf8");
  console.log(`Read compiled JS from: ${jsFilePath}`);

  await updateTaskStatus(taskId, 'succeed', `Compiled ${tsFileName} -> ${jsFileName}`);

  return compiledJs;
}

export const startAnchorInitTask = async (
  projectId: string,
  rootPath: string,
  projectName: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Init', creatorId, projectId);
  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const result = await runCommand(`docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"`, '.', taskId);
      return result;
    } catch (error: any) {
      console.error('Error in anchor init task:', error);
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });
  return taskId;
};

export const startSetClusterTask = async (
  projectId: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Config Set Devnet', creatorId, projectId);

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }

      const rootPath = await getProjectRootPath(projectId);

      await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor config set cluster devnet"`, '.', taskId);
    } catch (error: any) {
      console.error('Error setting anchor cluster:', error.message);
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

function transformRootPath(rootPath: string): string {
  return rootPath.replace(/-/g, '_');
}

export const getBuildArtifactTask = async (projectId: string): Promise<{ status: string, base64So: string, programId?: string, programKeypair?: string }> => {
  try {
    const rootPath = await getProjectRootPath(projectId);
    
    // Get the container name for this project
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      throw new Error(`No container found for project ${projectId}`);
    }
    
    console.log(`[ARTIFACT] Looking for compiled .so file in container ${containerName} for project ${projectId}`);
    
    // Create a temporary task ID for the command execution
    const tempTaskId = uuidv4();
    
    // find the first .so inside the correct target directory
    const locateCmd = `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy" && find "$SO_DIR" -maxdepth 1 -name "*.so" | head -n 1'`;
    const containerSoPath = (await runCommand(locateCmd, '.', tempTaskId, { skipSuccessUpdate: true })).trim();

    if (!containerSoPath) {
      console.error('[ARTIFACT] ❌  No .so produced by build');
      throw new Error('Built artifact not found in container');
    }
    
    console.log(`[ARTIFACT] ✓ Found .so file at ${containerSoPath}, extracting...`);
    
    // Read and encode the file directly from the container
    const base64Cmd = `docker exec ${containerName} bash -c "cat '${containerSoPath}' | base64 -w 0"`;
    const base64So = await runCommand(base64Cmd, '.', tempTaskId, { skipSuccessUpdate: true });
    
    console.log(`[ARTIFACT] ✓ Successfully encoded .so file to base64 (${base64So.length} bytes)`);
    
    // 🔍 Only look in the project's *own* target folder – a global search can
  // surface unrelated warm‑cache files (e.g. my_program‑keypair.json) and
  // trick Anchor into believing the wrong Program ID.
    let containerKeypairPath = '';
    let locateJsonCmd = `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && find target/deploy -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" | head -n 1'`;
    containerKeypairPath = (await runCommand(locateJsonCmd, '.', tempTaskId, { skipSuccessUpdate: true })).trim();
    
    if (!containerKeypairPath) {
      console.error('[ARTIFACT] ❌ No keypair JSON found in project target/deploy');
      throw new Error('Program keypair not found in container');
    }
    
    console.log(`[ARTIFACT] ✓ Found keypair file at ${containerKeypairPath}, reading...`);
    const keypairJson = await runCommand(`docker exec ${containerName} bash -c "cat '${containerKeypairPath}'"`, '.', tempTaskId, { skipSuccessUpdate: true });
    let programId = "";
    try {
      const secretKeyBytes = JSON.parse(keypairJson.trim());
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyBytes));
      programId = keypair.publicKey.toBase58();
      console.log(`[ARTIFACT] ✓ Extracted Program ID ${programId} from keypair`);
    } catch (e) {
      console.error('[ARTIFACT] Failed to parse keypair or derive programId:', e);
    }
    
    return { status: 'success', base64So, programId, programKeypair: keypairJson.trim() };
  } catch (error) {
    console.error('[ARTIFACT] Error retrieving built artifact:', error);
    return { status: 'failed', base64So: '' };
  }
};

export const startAnchorBuildTask = async (
  projectId: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Build', creatorId, projectId);
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPath  = await getProjectRootPath(projectId);
      const rootStem  = rootPath.replace(/-[a-f0-9]{8}$/, '');
      let programName = rootStem.replace(/-/g, '_');
      if (/^[0-9]/.test(programName)) programName = 'p' + programName;
      
      // ────────────────────────── Use existing deterministic keypair ──────────────────────────
      const walletPath = path.join(
        APP_CONFIG.WALLETS_FOLDER,
        // handleGenerateCode stored it under NEXT_PUBLIC_PROGRAM_ID
        fs.readdirSync(APP_CONFIG.WALLETS_FOLDER).find(f => f.endsWith('.json')) || ''
      );
      if (!walletPath) throw new Error('No program keypair found in wallets folder');

      const secretArr   = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      const programId   = Keypair.fromSecretKey(Uint8Array.from(secretArr)).publicKey.toBase58();
      const containerKeyPath  = `/usr/src/${rootPath}/target/deploy/${programName}-keypair.json`;
      await runCommand(
        `docker exec ${containerName} bash -c 'mkdir -p /usr/src/${rootPath}/target/deploy'`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
      // Symlink target/idl to target/deploy (Anchor expects this)
      await runCommand(
        `docker exec ${containerName} bash -c '[ ! -e /usr/src/${rootPath}/target/idl ] && ln -sfnT /usr/src/${rootPath}/target/deploy /usr/src/${rootPath}/target/idl || true'`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
      // copy *once* per build; idempotent ‑f
      await runCommand(
        `docker cp -f ${walletPath} ${containerName}:${containerKeyPath}`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
          // Store program ID in .env and database
      await runCommand(
        `docker exec ${containerName} bash -lc "sed -i '/^NEXT_PUBLIC_PROGRAM_ID=/d' /usr/src/${rootPath}/web/.env && echo NEXT_PUBLIC_PROGRAM_ID=${programId} >> /usr/src/${rootPath}/web/.env"`,
        '.',
        `inject-env-${Date.now()}`,
        { skipSuccessUpdate: true },
      );
      try {
        await pool.query(
          "UPDATE solanaproject SET details = COALESCE(details, '{}'::jsonb) || $1::jsonb WHERE id = $2",
          [JSON.stringify({ lastProgramId: programId }), projectId]
        );
      } catch (dbErr) {
        console.error('[BUILD] Warning: failed to update project details with programId:', dbErr);
      }

      const buildScriptContent = `#!/bin/bash
set -euo pipefail

cd /usr/src/${rootPath}

# build the Anchor workspace
anchor build -p ${programName} -- --jobs 1

# ── determine the correct target directory and find the first .so file ──
SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy"
SO_PATH=$(find "$SO_DIR" -maxdepth 1 -name '*.so' | head -n 1)

if [[ -z "$SO_PATH" ]]; then
  echo "BUILD_FAILURE: no .so in $SO_DIR"
  exit 1
fi

echo "BUILD_SUCCESS: $SO_PATH"
`;
      
      const tempDir = path.join(__dirname, '../../tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const buildScriptPath = path.join(tempDir, `build-${projectId}.sh`);
      fs.writeFileSync(buildScriptPath, buildScriptContent, 'utf8');
      
      console.log(`[BUILD] Created build script locally at ${tempDir}`);

      console.log(`[BUILD] Starting anchor build for project ${projectId}...`);
      
      try {
        await updateTaskStatus(sanitizedTaskId, 'doing', 'Anchor build in progress...');
        
        console.log(`[BUILD] Copying build script to container ${containerName}...`);
        await runCommand(
          `docker cp ${buildScriptPath} ${containerName}:/tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );
        
        console.log(`[BUILD] Making build script executable...`);
        await runCommand(
          `docker exec ${containerName} chmod +x /tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );
        
        console.log(`[BUILD] Executing build script in container ${containerName} (stream)…`);
        const buildOutput = await runSpawn(
          `docker exec ${containerName} /bin/bash /tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { sendProgress: d => console.log('[ANCHOR_BUILD]', (d as any).message?.trim() ?? '') }
        );
        
        // look for the *first* .so produced under the correct target directory
        const soFileCheck = await runCommand(
          `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy" && if ls "$SO_DIR"/*.so 1>/dev/null 2>&1; then echo "BUILD_SUCCESS"; else echo "BUILD_FAILURE"; fi'`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );
        
        try {
          fs.unlinkSync(buildScriptPath);
        } catch (cleanupError: any) {
          console.log(`[BUILD] Non-critical error cleaning up temp files: ${cleanupError.message}`);
        }
        
        if (soFileCheck.includes('BUILD_SUCCESS')) {
          console.log("[BUILD] ✔️  anchor build finished & .so produced");
          await updateTaskStatus(sanitizedTaskId, 'succeed', `Build completed successfully. .so file was created.`);
        } else if (soFileCheck.includes('BUILD_FAILURE')) {
          const fullBuildError = `[BUILD] ❌  Build finished but no .so was created.\n\nBuild output:\n${buildOutput}`;
          console.error(fullBuildError);
          await updateTaskStatus(sanitizedTaskId, 'failed', fullBuildError);
        }
        // no 'else' – runSpawn already set 'warning' when appropriate
      } catch (buildError: any) {
        console.error(`[BUILD] Anchor build failed with error: ${buildError.message}`);
        await updateTaskStatus(
          sanitizedTaskId,
          'failed',
          `Anchor build failed: ${buildError.message || 'Unknown build error occurred'}`
        );
        
        try {
          fs.unlinkSync(buildScriptPath);
        } catch (cleanupError: any) {
          console.log(`[BUILD] Non-critical error cleaning up temp files: ${cleanupError.message}`);
        }
      }
    } catch (error: any) {
      console.error(`[BUILD] Error in anchor build task: ${error.message}`);
      await updateTaskStatus(sanitizedTaskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

export const startAnchorDeployTask = async (
  projectId: string,
  creatorId: string,
  ephemeralPubkey?: string
): Promise<string> => {
  const taskId = await createTask('Anchor Deploy', creatorId, projectId);
  let programId: string | null = null;
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');
  
  if (ephemeralPubkey === 'SIGNED') {
    console.log('[DEPLOY] signed-tx path – skipping container key copy and awaiting frontend deployment');
    await updateTaskStatus(sanitizedTaskId, 'doing', 'Waiting for signed transaction from wallet...');
    return sanitizedTaskId;
  }

  console.log(`[DEPLOY_DEBUG] Starting anchor deploy task ${sanitizedTaskId} for project ${projectId}${ephemeralPubkey ? ' with ephemeral key: ' + ephemeralPubkey : ''}`);

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }

      const rootPath   = await getProjectRootPath(projectId);
      const rootStem   = rootPath.replace(/-[a-f0-9]{8}$/, '');
      let programName  = rootStem.replace(/-/g, '_');
      if (/^[0-9]/.test(programName)) programName = 'p' + programName;

      /* ──────────────────────────────────────────────────────────
       *  Symlink ./target/deploy → /usr/src/target/deploy
       *  so anchor deploy sees the artefact in the warmed cache.
       * ────────────────────────────────────────────────────────── */
      {
        // Build the one-liner (idempotent)
        const linkCmd = [
          `cd /usr/src/${rootPath}`,
          'rm -rf target/deploy',                // remove accidental dir, if any
          'mkdir -p target',
          // -T treats DEST as a file so ln never creates "deploy/deploy"
          'ln -sfnT /usr/src/target/deploy target/deploy'
        ].join(" && ");

        // Execute inside the running container
        await runCommand(
          `docker exec ${containerName} bash -c '${linkCmd}'`,
          ".",          // working dir irrelevant – we cd inside the command
          `symlink-${projectId}-${Date.now()}`,    // unique task-id
          { skipSuccessUpdate: true }
        );
        console.log(`[EPHEMERAL] Symlink created for ${rootPath}`);
      }

      await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url https://api.devnet.solana.com"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
      
      let walletPath;
      let containerWalletPath;
      
      if (ephemeralPubkey) {
        walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
        console.log(`[DEPLOY_DEBUG] Using ephemeral key for deployment: ${ephemeralPubkey}`);
        console.log(`[DEPLOY_DEBUG] Ephemeral key file path: ${walletPath}`);
        
        if (!fs.existsSync(walletPath)) {
          console.error(`[DEPLOY_DEBUG] ERROR: Ephemeral key file not found at ${walletPath}`);
          throw new Error(`Ephemeral key file not found at ${walletPath}`);
        }
        
        try {
          const fileStats = fs.statSync(walletPath);
          console.log(`[DEPLOY_DEBUG] Key file exists: ${walletPath}, size: ${fileStats.size} bytes`);
          
          const keyContent = fs.readFileSync(walletPath, 'utf8');
          const keyArray = JSON.parse(keyContent);
          console.log(`[DEPLOY_DEBUG] Key array length: ${keyArray.length}, first few bytes: [${keyArray.slice(0, 3).join(', ')}...]`);
          if (keyArray.length !== 64) {
            console.warn(`[DEPLOY_DEBUG] WARNING: Key file does not contain a 64-byte array! Found ${keyArray.length} bytes.`);
          }
        } catch (err: any) {
          console.error(`[DEPLOY_DEBUG] ERROR reading key file: ${err.message}`);
          throw new Error(`Error reading ephemeral key file: ${err.message}`);
        }
        
        containerWalletPath = `/tmp/${ephemeralPubkey}.json`;
        console.log(`[DEPLOY_DEBUG] Copying ephemeral key to container path: ${containerWalletPath}`);
        
        await runCommand(`docker cp ${walletPath} ${containerName}:${containerWalletPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        
        try {
          const fileCheckCmd = `docker exec ${containerName} ls -la ${containerWalletPath}`;
          const fileCheckResult = await runCommand(fileCheckCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
          console.log(`[DEPLOY_DEBUG] Container key file check: ${fileCheckResult}`);
          
          const pubkeyCmd = `docker exec ${containerName} bash -c "solana-keygen pubkey ${containerWalletPath} || echo 'KEYGEN_FAILED'"`;
          const pubkeyResult = await runCommand(pubkeyCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
          console.log(`[DEPLOY_DEBUG] Solana-keygen pubkey result: ${pubkeyResult.trim()}`);
          
          if (pubkeyResult.trim() !== ephemeralPubkey) {
            console.error(`[DEPLOY_DEBUG] ERROR: Key verification failed! Expected: ${ephemeralPubkey}, Got: ${pubkeyResult.trim()}`);
            throw new Error(`Ephemeral key verification failed. Expected: ${ephemeralPubkey}, Got: ${pubkeyResult.trim()}`);
          } else {
            console.log(`[DEPLOY_DEBUG] Key verification SUCCESS: ${pubkeyResult.trim()}`);
          }
          
          const anchorTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml || echo 'ANCHOR_TOML_NOT_FOUND'"`;
          const anchorTomlContent = await runCommand(anchorTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
          
          const walletLineMatch = anchorTomlContent.match(/wallet\s*=\s*["']([^"']+)["']/);
          if (walletLineMatch) {
            const walletPath = walletLineMatch[1];
            console.log(`[DEPLOY_DEBUG] Found wallet setting in Anchor.toml: ${walletPath}`);
            
            if (walletPath.includes('id.json') || walletPath.includes('~')) {
              console.warn(`[DEPLOY_DEBUG] WARNING: Anchor.toml specifies default wallet: ${walletPath}`);
              console.warn(`[DEPLOY_DEBUG] This might override command-line flags in some Anchor versions`);
              
              try {
                const modifiedToml = anchorTomlContent.replace(
                  /wallet\s*=\s*["'][^"']+["']/,
                  `wallet = "${containerWalletPath}"`
                );
                
                const updateTomlCmd = `docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/Anchor.toml" << 'EOF'\n${modifiedToml}\nEOF`;
                await runCommand(updateTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                console.log(`[DEPLOY_DEBUG] Updated Anchor.toml to use ephemeral key: ${containerWalletPath}`);
                
                const verifyTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml | grep wallet"`;
                const verifyResult = await runCommand(verifyTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                console.log(`[DEPLOY_DEBUG] Verified Anchor.toml wallet setting: ${verifyResult.trim()}`);
              } catch (tomlUpdateErr: any) {
                console.error(`[DEPLOY_DEBUG] Error updating Anchor.toml: ${tomlUpdateErr.message}`);
              }
            }
          } else {
            console.log(`[DEPLOY_DEBUG] No wallet setting found in Anchor.toml. Command-line flags should work.`);
          }
        } catch (verifyErr: any) {
          console.error(`[DEPLOY_DEBUG] Error during key verification: ${verifyErr.message}`);
        }
        
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --keypair ${containerWalletPath}"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
      } else {
        walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${creatorId}.json`);
        console.log(`Using creator key for deployment: ${creatorId}`);
        
        containerWalletPath = `/tmp/${creatorId}.json`;
        await runCommand(`docker cp ${walletPath} ${containerName}:${containerWalletPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --keypair ${containerWalletPath}"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
      }
      
            await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url devnet"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
      // Remove any existing program keypair files to ensure a new Program ID on each deployment
      await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && rm -f target/deploy/*-keypair.json"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
      console.log(`[DEPLOY] Removed existing program keypair files to force fresh program ID`);
      
      const anchorDeployCmd = `anchor deploy -p ${programName} \
        --provider.wallet ${containerWalletPath} \
        --provider.cluster devnet`;
      
      console.log(`Running deploy with wallet flag: --provider.wallet ${containerWalletPath}`);
      
      console.log(`[EPHEMERAL_DEBUG] Checking Anchor.toml configuration...`);
      try {
        const anchorTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml || echo 'ANCHOR_TOML_NOT_FOUND'"`;
        const anchorTomlContent = await runCommand(anchorTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        
        const walletMatch = anchorTomlContent.match(/wallet\s*=\s*["']([^"']+)["']/);
        if (walletMatch) {
          console.log(`[EPHEMERAL_DEBUG] Found wallet in Anchor.toml: ${walletMatch[1]}`);
          
          if (walletMatch[1].includes('id.json')) {
            console.warn(`[EPHEMERAL_DEBUG] WARNING: Anchor.toml specifies default wallet: ${walletMatch[1]}`);
            console.warn(`[EPHEMERAL_DEBUG] This might override command-line flags in some Anchor versions`);
          }
        } else {
          console.log(`[EPHEMERAL_DEBUG] No wallet setting found in Anchor.toml, command-line flags should work`);
        }
      } catch (tomlErr: any) {
        console.error(`[EPHEMERAL_DEBUG] Error checking Anchor.toml: ${tomlErr.message}`);
      }
      
      const deployCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor deploy -p ${programName} --provider.wallet ${containerWalletPath} --provider.cluster devnet 2>&1"`;
      console.log(`[DEPLOY_DEBUG] Running command: ${deployCmd}`);
      
      const result = await runCommand(deployCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true }).catch(async (error: any) => {
        console.error('Error during deployment:', sanitizedTaskId, error);
        
        console.log(`[EPHEMERAL_DEBUG] Deployment failed.`);
        // Fallback removed - modern Anchor only accepts --provider.wallet
        
        const errorResult = JSON.stringify({
          status: 'failed',
          error: error.message
        });
        await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
        return `Error: ${error.message}`;
      });

      console.log(`[DEPLOY_DEBUG] Full deploy output (first 1000 chars):\n${result?.substring(0, 1000)}`);

      if (result && result.startsWith('Error:')) {
        console.error(`Deployment failed for Task ID: ${sanitizedTaskId}. Reason: ${result}`);
        const errorResult = JSON.stringify({
          status: 'failed',
          error: result
        });
        await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
        return;
      }

      console.log(`[DEPLOY_DEBUG] Searching for Program Id in output...`);
      const programIdRegex = /Program Id:\s*([a-zA-Z0-9]{32,44})/;
      const programIdMatch = result?.match(programIdRegex);
      
      if (programIdMatch) {
        console.log(`[DEPLOY_DEBUG] Found Program Id: ${programIdMatch[1]}`);
        programId = programIdMatch[1];
      } else {
        console.log(`[DEPLOY_DEBUG] WARNING: No Program Id found in output! Searching the entire output for base58-like strings...`);
        
        const base58Regex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
        const potentialIds = result?.match(base58Regex) || [];
        if (potentialIds.length > 0) {
          console.log(`[DEPLOY_DEBUG] Found potential base58 program IDs: ${potentialIds.join(', ')}`);
          
          if (potentialIds.length > 0) {
            programId = potentialIds[0] || null;
            console.log(`[DEPLOY_DEBUG] Using first potential base58 string as Program ID: ${programId}`);
          }
        } else {
          console.log(`[DEPLOY_DEBUG] No base58-like strings found in output!`);
          const errorResult = JSON.stringify({
            status: 'failed',
            error: 'Program ID not found in deploy output'
          });
          await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
          throw new Error('Program ID not found in deploy output. Deployment may have failed.');
        }
      }

      console.log(`[DEPLOY_DEBUG] Using Program ID: ${programId}`);
      
      if (programId) console.log(`Program successfully deployed with ID: ${programId}`);
      
      try {
        if (programId && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
          console.error(`[DEPLOY_DEBUG] ERROR: Invalid program ID format: ${programId}`);
          const errorResult = JSON.stringify({
            status: 'failed',
            error: `Invalid program ID format: ${programId}`
          });
          await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
          throw new Error(`Invalid program ID format: ${programId}`);
        }
        
        if (!programId) {
          console.error(`[DEPLOY_DEBUG] ERROR: Program ID is null or undefined`);
          const errorResult = JSON.stringify({
            status: 'failed',
            error: 'Program ID is null or undefined'
          });
          await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
          throw new Error('Program ID is null or undefined');
        }
        
        const checkProgramCmd = `docker exec ${containerName} bash -c "solana program show ${programId} --url devnet || echo 'PROGRAM_NOT_FOUND'"`;
        const checkProgramResult = await runCommand(checkProgramCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        console.log(`[DEPLOY_DEBUG] Program verification: ${checkProgramResult.substring(0, 500)}`);
        
        if (checkProgramResult.includes('PROGRAM_NOT_FOUND')) {
          console.warn(`[DEPLOY_DEBUG] WARNING: Program ${programId} not found on devnet. It may not be deployed properly.`);
        } else {
          console.log(`[DEPLOY_DEBUG] Program ${programId} successfully verified on devnet.`);
        }
      } catch (verifyProgramErr: any) {
        console.error(`[DEPLOY_DEBUG] Error verifying program ID: ${verifyProgramErr.message}`);
      }
      
      // Update the frontend .env with the new Program ID
      if (programId) {
        try {
          const envUpdateCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && if [ -d web ]; then if [ -f web/.env ] && grep -q '^REACT_APP_PROGRAM_ID=' web/.env; then sed -i 's/^REACT_APP_PROGRAM_ID=.*/REACT_APP_PROGRAM_ID=${programId}/' web/.env; else echo 'REACT_APP_PROGRAM_ID=${programId}' >> web/.env; fi; fi"`;
          await runCommand(envUpdateCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
          console.log(`[DEPLOY] Updated web/.env with Program ID: ${programId}`);
        } catch (updateErr: any) {
          console.error(`[DEPLOY] Failed to update web/.env: ${updateErr.message}`);
        }
      }

      const successResult = JSON.stringify({
        status: 'success',
        programId: programId
      });
      
      console.log(`[DEPLOY_DEBUG] Final program ID to be returned to client: '${programId}'`);
      console.log(`[DEPLOY_DEBUG] Task result JSON: ${successResult}`);
      
      await updateTaskStatus(
        sanitizedTaskId,
        'succeed',
        successResult
      );
    } catch (error: any) {
      console.error('Error during deployment:', sanitizedTaskId, error);
      const errorResult = JSON.stringify({
        status: 'failed',
        error: error.message
      });
      await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
      return;
    }
  });

  return sanitizedTaskId;
};

export const startAnchorTestTask = async (
  projectId: string,
  creatorId: string
): Promise<string> => {
  const taskId = await createTask('Anchor Test', creatorId, projectId);
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPath   = await getProjectRootPath(projectId);
      const rootStem   = rootPath.replace(/-[a-f0-9]{8}$/, '');
      let programName  = rootStem.replace(/-/g, '_');
      if (/^[0-9]/.test(programName)) programName = 'p' + programName;
      
      const testCmd=`
        docker exec ${containerName} bash -c '
          cd /usr/src/${rootPath} &&
            anchor test -p ${programName} -- --jobs 1
        '
      `;
      await runCommand(testCmd.trim(), '.', taskId);
    } catch (error: any) {
      await updateTaskStatus(sanitizedTaskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

export const startCustomCommandTask = async (
  projectId: string,
  creatorId: string,
  commandType: 'anchor clean' | 'cargo clean' | 'runFunction',
  functionName?: string,
  parameters?: any[],
  ephemeralPubkey?: string,
): Promise<string> => {
  const taskId = await createTask(
    commandType === 'runFunction' ? `Run Function: ${functionName}` : commandType, 
    creatorId, 
    projectId
  );

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      if (commandType === 'runFunction' && functionName) {
        await updateTaskStatus(taskId, 'doing', `Executing function ${functionName}...`);
        try {
          const output = await runUserProjectCode(projectId, taskId, functionName, parameters, ephemeralPubkey);
          if (output.includes('ERROR:')) {
            throw new Error(output.split('ERROR:')[1].trim());
          }
          try {
            const parsedResult = JSON.parse(output);
            await updateTaskStatus(taskId, 'succeed', JSON.stringify(parsedResult));
          } catch (parseError) {
            const wrappedResult = { message: output };
            await updateTaskStatus(taskId, 'succeed', JSON.stringify(wrappedResult));
          }
        } catch (error: any) {
          console.error(`Error executing function:`, error);
          await updateTaskStatus(taskId, 'failed', `Error executing function: ${error.message}`);
        }
      } else {
        const rootPath = await getProjectRootPath(projectId);
        
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${commandType}"`, '.', taskId);
      }
    } catch (error: any) {
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

export const startInstallPackagesTask = async (
  projectId: string,
  creatorId: string,
  _packages?: string[]
): Promise<string> => {
  const taskId = await createTask('Install NPM Packages', creatorId, projectId);

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPath = await getProjectRootPath(projectId);
      
      // Instead of direct npm install, we add the packages to package.json
      // and touch a stamp file that will force a rebuild on next Docker build
      
      // Add standard packages
      const standardPackages = [
        '@coral-xyz/anchor',
        '@solana/web3.js',
        '@solana/spl-token',
        'fs'
      ];
      
      for (const pkg of standardPackages) {
        // ① write the dep into package.json (npm pkg set keeps formatting)
        // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
        const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
        // ② touch a stamp file – the Dockerfile COPY line already invalidates on it
        const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
        const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${addDeps} && date > ${stampPath}"`;
        await runCommand(cmd, '.', taskId);
      }

      // Add custom packages
      if (_packages) {
        for (const pkg of _packages) {
          // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
          const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
          const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
          const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${addDeps} && date > ${stampPath}"`;
          await runCommand(cmd, '.', taskId);
        }
      }
      
      await updateTaskStatus(taskId, 'succeed', 'Dependencies added to package.json. They will be installed on next container rebuild.');
    } catch (error: any) {
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

export const startInstallNodeDependenciesTask = async (
  projectId: string,
  creatorId: string,
  packages: string[],
  targetDir: 'app' | 'server' = 'app'
): Promise<string> => {
  const taskId = await createTask('Install Node Dependencies', creatorId, projectId);
  console.log(`Starting node dependency installation task for project ${projectId} with packages:`, packages);

  setImmediate(async () => {
    try {
      if (packages.length === 0) {
        console.log(`No packages to install for project ${projectId}`);
        await updateTaskStatus(taskId, 'succeed', 'No packages to install');
        return;
      }
      
      const containerName = await getContainerName(projectId);
      
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      const rootPathResult = await pool.query(
        'SELECT name FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      let rootPath = '';
      if (rootPathResult.rows.length > 0) {
        rootPath = normalizeProjectName(rootPathResult.rows[0].name);
      } else {
        throw new Error(`Could not determine project name for project ${projectId}`);
      }
      
      console.log(`Found container ${containerName} for project ${projectId}`);
      
      await updateTaskStatus(taskId, 'doing', `Adding ${packages.join(', ')} to package.json in ${targetDir}...`);
      console.log(`Adding packages to package.json: ${packages.join(', ')} for project ${projectId} in ${targetDir}`);
      
      try {
        // Instead of direct npm install, add each package to package.json
        for (const pkg of packages) {
          // ① write the dep into package.json (npm pkg set keeps formatting)
          // npm pkg set requires the whole arg in one quoted string; avoid slash-escaping hell
          const addDeps = `npm pkg set "dependencies.${pkg}@latest"`;
          // ② touch a stamp file – the Dockerfile COPY line already invalidates on it
          const stampPath = `/usr/src/${rootPath}/.force-reinstall`;
          // CRA lives under /app, Next.js under /web; respect caller's targetDir
          const subDir = targetDir === 'app' ? 'web' : targetDir;   // <- tweak if you use CRA elsewhere
          const cmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/${subDir} && ${addDeps} && date > ${stampPath}"`;
          await runCommand(cmd, '.', taskId);
        }
        
        console.log(`Successfully added packages to package.json in ${containerName} (${targetDir})`);
        await updateTaskStatus(taskId, 'succeed', `Dependencies added to package.json in ${targetDir}. They will be installed on next container rebuild.`);
      } catch (error: any) {
        console.error(`Failed to add packages to package.json. Error:`, error);
        await updateTaskStatus(taskId, 'failed', `Error adding dependencies to package.json: ${error.message}`);
      }
    } catch (error: any) {
      console.error(`Error in startInstallNodeDependenciesTask:`, error);
      await updateTaskStatus(taskId, 'failed', `Error: ${error.message}`);
    }
  });

  return taskId;
};

function hybridRootPackageJson(projectName: string, projectDesc: string = 'A React application') {
  return {
    name: projectName
      .toLowerCase()
      .replace(/\s+/g, '-'),  
    version: '0.1.0',
    description: projectDesc,
    private: true,
    scripts: {
      "start": "react-scripts start",
      "build": "react-scripts build",
      "test": "react-scripts test",
      "eject": "react-scripts eject"
    },
    dependencies: {
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "react-scripts": "5.0.1",
      "web-vitals": "^2.1.4",
      "@testing-library/jest-dom": "^5.16.5",
      "@testing-library/react": "^13.4.0",
      "@testing-library/user-event": "^13.5.0"
    },
    devDependencies: {
      "@types/react": "^18.0.28",
      "@types/react-dom": "^18.0.11",
      "@types/node": "^16.18.12",
      "@types/jest": "^27.5.2",
      "typescript": "^4.9.5"
    },
    eslintConfig: {
      "extends": [
        "react-app",
        "react-app/jest"
      ]
    },
    browserslist: {
      "production": [
        ">0.2%",
        "not dead",
        "not op_mini all"
      ],
      "development": [
        "last 1 chrome version",
        "last 1 firefox version",
        "last 1 safari version"
      ]
    }
  };
}

export const closeProjectContainer = async (
  projectId: string,
  creatorId: string,
  commitBeforeClose: boolean = false,
  removeContainer: boolean = false
): Promise<string> => {
  const taskId = await createTask('Close Project Container', creatorId, projectId);
  const sanitizedTaskId = taskId.trim().replace(/,$/, '');

  setImmediate(async () => {
    try {
      const containerName = await getContainerName(projectId);
      
      if (!containerName) {
        throw new Error(`No container found for project ${projectId}`);
      }
      
      console.log(`Closing container ${containerName} for project ${projectId}`);
      
      if (commitBeforeClose) {
        try {
          const checkGitCmd = `docker exec ${containerName} bash -c "if [ -d /usr/src/.git ]; then echo 'git-exists'; else echo 'no-git'; fi"`;
          const gitExists = await runCommand(checkGitCmd, '.', sanitizedTaskId);
          
          if (gitExists.trim() === 'git-exists') {
            console.log(`Git repository found in container ${containerName}, committing changes...`);
            
            const commitCmd = `
              docker exec ${containerName} bash -c "
                cd /usr/src &&
                git add . &&
                git commit -m 'Changes before container close - $(date)' || true &&
                git push origin main || true
              "
            `;
            await runCommand(commitCmd, '.', sanitizedTaskId);
          } else {
            console.log(`No Git repository found in container ${containerName}, skipping commit`);
          }
        } catch (gitError: any) {
          console.error(`Error during Git operations:`, gitError);
        }
      }
      
      if (removeContainer) {
        pruneContainerResources(containerName, projectId);
        // clear DB pointer – keep row for audit
        await pool.query(
          `UPDATE solanaproject
              SET container_name = NULL,
                  container_url  = NULL
            WHERE id = $1`,
          [projectId]
        );
        console.log(`Container ${containerName} and all project-labelled resources pruned`);
      } else {
        await runCommand(`docker stop ${containerName}`, '.', sanitizedTaskId);
        console.log(`Container ${containerName} stopped (kept for warm pool)`);
      }
      
      await updateTaskStatus(
        sanitizedTaskId,
        'succeed',
        `Container ${containerName} for project ${projectId} ${removeContainer ? 'stopped and removed' : 'stopped'} successfully`
      );
    } catch (error: any) {
      console.error(`Error closing project container:`, error);
      await updateTaskStatus(
        sanitizedTaskId,
        'failed',
        `Error closing project container: ${error.message}`
      );
    }
  });
  
  return sanitizedTaskId;
};

export async function getContainerName(projectId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT "container_name" FROM solanaproject WHERE id = $1',
    [projectId]
  );
  if (!result.rows.length || !result.rows[0].container_name) {
    return null;
  }
  return result.rows[0].container_name;
}

async function waitForServerReady(containerName: string, maxAttempts = 30, delayMs = 1000): Promise<boolean> {
  console.log(`Waiting for CRA server to be ready in container ${containerName}...`);
  
  const projectIdResult = await pool.query(
    'SELECT id FROM solanaproject WHERE container_name = $1',
    [containerName]
  );
  
  if (!projectIdResult.rows.length) {
    console.log(`Could not find project ID for container ${containerName}`);
    return false;
  }
  
  const projectId = projectIdResult.rows[0].id;
  
  const rootPathResult = await pool.query(
    'SELECT name FROM solanaproject WHERE id = $1',
    [projectId]
  );
  
  let rootPath = '';
  if (rootPathResult.rows.length > 0) {
    rootPath = normalizeProjectName(rootPathResult.rows[0].name);
  } else {
    console.log(`Could not determine project name for project ${projectId}`);
    return false;
  }
  
  try {
    const processCheck = await new Promise<string>((resolve) => {
      exec(`docker exec ${containerName} bash -c "ps aux | grep 'react-scripts start' | grep -v grep"`, 
        (error, stdout) => {
          resolve(stdout.trim());
        });
    });
    
    console.log(`CRA process check: ${processCheck ? "Process found" : "No process found"}`);
    
    if (!processCheck) {
      console.log("CRA dev server process is not running - checking logs for errors:");
      await new Promise<void>((resolve) => {
        exec(`docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/app/cra-startup.log || echo 'No log file'"`, 
          (error, stdout) => {
            console.log("CRA startup log contents:", stdout);
            resolve();
          });
      });
    }
  } catch (error) {
    console.log("Error checking for CRA process:", error);
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const checkCmd = `docker exec ${containerName} bash -c "curl -s http://localhost:3000 -o /dev/null -w '%{http_code}' || curl -s http://0.0.0.0:3000 -o /dev/null -w '%{http_code}'"`;
      const result = await new Promise<string>((resolve, reject) => {
        exec(checkCmd, (error, stdout, stderr) => {
          if (error && !stdout.includes('200')) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        });
      });
      
      if (result === '200') {
        console.log(`CRA server is ready in container ${containerName} after ${attempt} attempts`);
        return true;
      }
      console.log(`Attempt ${attempt}/${maxAttempts}: Server not ready yet, status code: ${result}`);
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxAttempts}: Server not responding yet`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  console.log(`Server did not become ready after ${maxAttempts} attempts`);
  return false;
}

export async function runUserProjectCode(
  projectId: string,
  taskId: string,
  functionName: string,
  parameters: any,
  ephemeralPubkey?: string
): Promise<string> {
  const containerName = await getContainerName(projectId);
  
  if (!containerName) {
    throw new Error(`No container found for project ${projectId}`);
  }
  
  const rootPathResult = await pool.query(
    'SELECT name FROM solanaproject WHERE id = $1',
    [projectId]
  );
  
  let rootPath = '';
  if (rootPathResult.rows.length > 0) {
    rootPath = normalizeProjectName(rootPathResult.rows[0].name);
  } else {
    throw new Error(`Could not determine project name for project ${projectId}`);
  }
  
  console.log(`Found container ${containerName} for project ${projectId}`);
  
  const tempRunnerDir = `/usr/src/${rootPath}/app/_temp_${taskId}`;
  await runCommand(`docker exec ${containerName} mkdir -p ${tempRunnerDir}`, '.', taskId);

  const runnerSrcPath = path.join(__dirname, '../../runners/myRunnerTemplate.ts');
  const ephemeralSrcPath = path.join(__dirname, '../../runners/ephemeralKeyUtils.ts');
  const localBundlrSrcPath = path.join(__dirname, '../../runners/localBundlrUtils.ts');

  await runCommand(`docker cp ${runnerSrcPath} ${containerName}:${tempRunnerDir}/runner.ts`, '.', taskId);
  await runCommand(`docker cp ${ephemeralSrcPath} ${containerName}:${tempRunnerDir}/ephemeralKeyUtils.ts`, '.', taskId);
  await runCommand(`docker cp ${localBundlrSrcPath} ${containerName}:${tempRunnerDir}/localBundlrUtils.ts`, '.', taskId);

  let finalParams: any;
  if (Array.isArray(parameters)) {
    finalParams = ephemeralPubkey ? [...parameters, ephemeralPubkey] : parameters;
  } else {
    finalParams = ephemeralPubkey ? { ...parameters, ephemeralPubkey } : parameters;
  }

  const paramsContent = JSON.stringify(finalParams, null, 2);
  const writeParamsCmd = `docker exec -i ${containerName} bash -c "cat > ${tempRunnerDir}/params.json" << 'EOF'
${paramsContent}
EOF`;
  await runCommand(writeParamsCmd, '.', taskId);

  const compileCommand = [
    'npx ts-node',
    '--skip-project',
    '--transpile-only',
    `--compiler-options '{"module":"commonjs","esModuleInterop":true}'`,
    `"${tempRunnerDir}/runner.ts"`,
    `"${tempRunnerDir}/params.json"`
  ].join(' ');
  
  const dockerRunCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/app && ${compileCommand}"`;
  const commandResult = await runCommand(dockerRunCmd, '.', taskId);

  await runCommand(`docker exec ${containerName} rm -rf ${tempRunnerDir}`, '.', taskId);

  return commandResult;
}

/**
 * Relay and sign an unsigned deployment/upgrade transaction using the
 * program's secret key retrieved from AWS Secrets Manager.
 * @param projectId Project ID for logging/DB consistency.
 * @param programId Program ID whose keypair will be used to sign.
 * @param encodedTx Base64‑encoded unsigned transaction.
 * @returns The confirmed signature string.
 */
export async function broadcastSignedTx(
  projectId: string,
  programId: string,
  encodedTx: string,
): Promise<string> {
  console.log(
    `[broadcastSignedTx] project ${projectId} signing and relaying for program ${programId}…`,
  );
  // Decode the serialized transaction
  const rawBuffer = Buffer.from(encodedTx, 'base64');
  const tx = Transaction.from(rawBuffer);
  
  // Retrieve the secret key from Secrets Manager and sign
  let signer: Keypair;
  try {
    const secretKey = await getProgramSecret(programId);
    signer = Keypair.fromSecretKey(secretKey);
    console.log(`[broadcastSignedTx] Retrieved program secret key from AWS Secrets Manager for ${programId}`);
  } catch (e: any) {
    console.log(`[broadcastSignedTx] AWS retrieval failed, falling back to local file: ${e.message}`);
    // Fallback when AWS disabled or creds invalid
    if (awsSecretsEnabled() && e.message !== 'AWS credentials invalid') {
      throw e;
    }
    // Fallback: read the cached keypair JSON written during build
    const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${programId}.json`);
    if (!fs.existsSync(walletPath)) {
      console.error(`[broadcastSignedTx] ERROR: Program keypair file not found at ${walletPath}`);
      throw new Error(`Program keypair not found at ${walletPath}`);
    }
    try {
      const secretArr = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      signer = Keypair.fromSecretKey(Uint8Array.from(secretArr));
      console.log(`[broadcastSignedTx] Using locally stored keypair for ${programId}`);
    } catch (err: any) {
      console.error(`[broadcastSignedTx] ERROR: Failed to parse program keypair from ${walletPath}: ${err.message}`);
      throw new Error(`Failed to parse program keypair: ${err.message}`);
    }
  }
  
  // Sign the transaction with the program keypair
  try {
    tx.partialSign(signer);
    console.log(`[broadcastSignedTx] Successfully signed transaction with program keypair ${programId}`);
  } catch (err: any) {
    console.error(`[broadcastSignedTx] ERROR: Failed to sign transaction with program key: ${err.message}`);
    throw new Error(`Failed to sign transaction with program key: ${err.message}`);
  }
  
  // Broadcast the fully signed transaction
  try {
    const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log(`[broadcastSignedTx] Broadcasting transaction to Solana devnet...`);
    const signature = await sendAndConfirmRawTransaction(conn, tx.serialize());
    console.log(`[broadcastSignedTx] Transaction confirmed with signature: ${signature}`);
    return signature;
  } catch (err: any) {
    console.error(`[broadcastSignedTx] ERROR: Failed to broadcast transaction: ${err.message}`);
    throw new Error(`Failed to broadcast transaction: ${err.message}`);
  }
}

/**
 * Signs a partially-signed deploy transaction with the fixed program keypair (generated during codegen)
 * and broadcasts it to Devnet. This helper ensures the program's secret key remains on the backend,
 * never reaching the client.
 *
 * Steps:
 *   1. Locate the `*-keypair.json` file inside `/usr/src/target/deploy` of the project's container.
 *   2. Load the secret key, derive the programId, and verify it matches the expected `programId`.
 *   3. Decode the partial transaction from `encodedTx`, add the program signature via `partialSign`.
 *   4. Broadcast the fully signed transaction and return its signature.
 *
 * @param projectId  ID of the project whose container holds the compiled artifacts.
 * @param encodedTx  Base64-encoded partially-signed transaction (ephemeral signature present).
 * @param programId  Expected public key of the program; used to verify we loaded the correct keypair.
 * @returns         Transaction signature of the deployed program.
 */
export async function signDeployTxAndBroadcast(
  projectId: string,
  encodedTx: string,
  programId: string
): Promise<string> {
  // Find the container for this project.
  const containerName = await getContainerName(projectId);
  if (!containerName) {
    throw new Error(`No container found for project ${projectId}`);
  }
  
  // Get project root path for project-specific search
  const rootPath = await getProjectRootPath(projectId);
  
  // Use a temporary task ID to avoid polluting the task database.
  const tempTaskId = uuidv4();
  
  // 1️⃣ First search in the project sub-folder
  let listCmd = `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && find target/deploy -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" -print'`;
  let listOutput = await runCommand(listCmd, '.', tempTaskId, { skipSuccessUpdate: true });
  let candidates = listOutput.split(/\r?\n/).filter(Boolean);
  
  // 2️⃣ If nothing found in project folder, search in the global folder
  if (candidates.length === 0) {
    listCmd = `docker exec ${containerName} bash -c 'find /usr/src/target/deploy -maxdepth 1 -name "*-keypair.json" ! -name "anchor_template-*" -print'`;
    listOutput = await runCommand(listCmd, '.', tempTaskId, { skipSuccessUpdate: true });
    candidates = listOutput.split(/\r?\n/).filter(Boolean);
  }
  
  if (candidates.length === 0) {
    throw new Error('No *-keypair.json files found after global + local search');
  }
  
  console.log(`[SIGNING] Found ${candidates.length} keypair candidate(s): ${candidates.join(', ')}`);
  
  let programKeypair: Keypair | null = null;
  for (const candidate of candidates) {
    try {
      const content = await runCommand(
        `docker exec ${containerName} bash -c "cat '${candidate}'"`,
        '.',
        tempTaskId,
        { skipSuccessUpdate: true },
      );
      const arr = JSON.parse(content.trim());
      if (Array.isArray(arr) && arr.length === 64) {
        const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
        const pubkey = kp.publicKey.toBase58();
        console.log(`[SIGNING] Candidate ${candidate} has public key ${pubkey}`);
        if (pubkey === programId) {
          console.log(`[SIGNING] ✓ Found matching keypair at ${candidate}`);
          programKeypair = kp;
          break;
        }
      }
    } catch (err) {
      console.log(`[SIGNING] Error processing ${candidate}: ${err}`);
      continue;
    }
  }
  if (!programKeypair) {
    throw new Error(`No keypair matches program ID ${programId} after checking ${candidates.length} candidates`);
  }
  // Decode the partial transaction and add the program signature.
  const raw = Buffer.from(encodedTx, 'base64');
  const transaction = Transaction.from(raw);
  transaction.partialSign(programKeypair);
  // Broadcast the fully signed transaction.
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // ── DEBUG ── try a cheap simulation first so we see on‑chain logs
  const sim = await conn.simulateTransaction(transaction);
  console.log('SIM logs:', sim.value.logs);
  if (sim.value.err) {
    console.error('Simulation FAILED →', sim.value.err);
    throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
  }
  
  const sig = await sendAndConfirmRawTransaction(conn, transaction.serialize());
  return sig;
}

/**
 * Runs a command in a detached process, not waiting for completion.
 * Useful for long-running processes like dev servers.
 */
export async function runCommandDetached(
  command: string,
  cwd: string,
  taskId: string,
  options: { shell?: string } = {}
): Promise<void> {
  console.log(`[DETACHED] Running command: ${command} in ${cwd}`);
  
  const spawnOptions: SpawnOptions = {
    cwd,
    detached: true,
    stdio: 'ignore',
    shell: options.shell || '/bin/bash'  // guarantees a shell is available inside the tool-chain image
  };
  
  try {
    const child = spawn(command, [], spawnOptions);
    
    // Unref the child to allow the parent process to exit independently
    child.unref();
    
    console.log(`[DETACHED] Process started with PID ${child.pid}`);
    
    // Log the start but don't wait for completion
    await updateTaskStatus(
      taskId, 
      'doing', 
      `Started detached process: ${command} (PID: ${child.pid})`
    );
  } catch (error: any) {
    console.error(`[DETACHED] Failed to start command: ${error.message}`);
    await updateTaskStatus(
      taskId, 
      'failed', 
      `Failed to start detached process: ${error.message}`
    );
    throw error;
  }
}