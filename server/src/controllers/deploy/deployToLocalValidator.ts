import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getContainerName } from "../../utils/container/getContainerName";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import { getProjectRootPath } from '../../utils/fileUtils';
import pool from "src/config/database";

/**
 * Helper function to ensure validator is running and accessible
 */
async function ensureValidatorRunning(containerName: string): Promise<void> {
  console.log('[LOCAL_DEPLOY] Checking validator status...');
  
  // Check if validator is already running using the script
  try {
    const statusCmd = `docker exec ${containerName} /tmp/start-validator.sh status`;
    const status = await runCommand(statusCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    if (status.includes('Validator is running')) {
      console.log('[LOCAL_DEPLOY] Validator already running');
      return;
    }
  } catch {
    // Validator not running, proceed to start it
  }
  
  console.log('[LOCAL_DEPLOY] Starting validator with proper network binding...');
  
  // First kill any existing validator processes
  const killCmd = `docker exec ${containerName} pkill -f solana-test-validator || true`;
  await runCommand(killCmd, '.', uuidv4(), { skipSuccessUpdate: true });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start validator with explicit bind address for external access
  const startCmd = `docker exec -d ${containerName} solana-test-validator \
    --bind-address 0.0.0.0 \
    --rpc-port 8899 \
    --ws-port 8900 \
    --faucet-port 9900 \
    --reset \
    --quiet`;
  
  try {
    await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    console.log('[LOCAL_DEPLOY] Validator start command issued');
  } catch (err) {
    // Try alternative start method using the script
    console.log('[LOCAL_DEPLOY] Trying alternative start method...');
    const scriptCmd = `docker exec ${containerName} /tmp/start-validator.sh reset`;
    try {
      const output = await runCommand(scriptCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      console.log('[LOCAL_DEPLOY] Script output:', output);
    } catch (scriptErr) {
      console.error('[LOCAL_DEPLOY] Both start methods failed:', err, scriptErr);
      throw new Error(`Failed to start validator: ${err}`);
    }
  }
  
  // Wait for validator to be ready
  console.log('[LOCAL_DEPLOY] Waiting for validator to be ready...');
  for (let i = 1; i <= 30; i++) {
    try {
      const healthCmd = `docker exec ${containerName} curl -s http://127.0.0.1:8899/health`;
      const result = await runCommand(healthCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (result && result.includes('ok')) {
        console.log('[LOCAL_DEPLOY] Validator is ready!');
        return;
      }
    } catch {
      // Not ready yet
    }
    
    if (i % 5 === 0) {
      console.log(`[LOCAL_DEPLOY] Still waiting... (${i}/30)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Validator failed to become accessible after 30 seconds');
}


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
      const { walletPubkey } = req.body;
      
      console.log(`[LOCAL_DEPLOY] Starting local deployment for project ${projectId}`);
      console.log(`[LOCAL_DEPLOY] Wallet: ${walletPubkey || 'none'}`);
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        return next(new AppError('Container not found', 404));
      }
      
      // Step 1: Ensure validator is running and accessible
      await ensureValidatorRunning(containerName);
      
      // Step 2: Get program details from the database and built artifacts
      const db = pool;
      
      // Get the actual program name and root path from the database
      const programQuery = await db.query(
        `SELECT name, root_path 
         FROM solanaproject 
         WHERE id = $1`,
        [projectId]
      );
      
      if (!programQuery.rows[0]) {
        throw new Error('Project not found');
      }
      
      // Derive program name from project name (solanaproject doesn't have program_name field)
      const projectData = programQuery.rows[0];
      const programName = projectData.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 
                         'untitled_project';
      
      // Get the actual root path from the database or use the one from getProjectRootPath
      const rootPath = projectData.root_path || await getProjectRootPath(projectId);
      const programPath = `/usr/src/${rootPath}`;
      
      console.log('[LOCAL_DEPLOY] Program name:', programName);
      console.log('[LOCAL_DEPLOY] Root path:', rootPath);
      console.log('[LOCAL_DEPLOY] Program path:', programPath);
      
      // Check if build artifact exists in the container at the correct location
      let soFile = `/usr/src/${rootPath}/target/deploy/${programName}.so`;
      let keypairFile = `/usr/src/${rootPath}/target/deploy/${programName}-keypair.json`;
      
      console.log('[LOCAL_DEPLOY] Checking for artifact at:', soFile);
      
      // Verify the .so file exists (it should from the build pipeline)
      const soExistsCmd = `docker exec ${containerName} test -f "${soFile}" && echo "exists" || echo "missing"`;
      const soExists = await runCommand(soExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (soExists.trim() === 'missing') {
        // Try alternate paths first - check if it's in /usr/src/target/deploy (without project subdirectory)
        const altSoPath = `/usr/src/target/deploy/${programName}.so`;
        const altKeypairPath = `/usr/src/target/deploy/${programName}-keypair.json`;
        
        console.log('[LOCAL_DEPLOY] Checking alternate path:', altSoPath);
        const altCheckCmd = `docker exec ${containerName} test -f "${altSoPath}" && echo "exists" || echo "missing"`;
        const altExists = await runCommand(altCheckCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        
        if (altExists.trim() === 'exists') {
          console.log('[LOCAL_DEPLOY] Found artifacts at alternate location:', altSoPath);
          // Update paths to use alternate location
          soFile = altSoPath;
          keypairFile = altKeypairPath;
        } else {
          // Try to copy from the project's target directory on host
          const hostRoot = process.env.ROOT_FOLDER;
          if (hostRoot) {
            // Try multiple possible paths
            const possiblePaths = [
              `${hostRoot}/${rootPath}/target/deploy/${programName}.so`,
              `${hostRoot}/target/deploy/${programName}.so`,
              `${hostRoot}/projects/${projectId}/target/deploy/${programName}.so`
            ];
            
            const fs = require('fs');
            let foundPath = null;
            let foundKeypairPath = null;
            
            for (const path of possiblePaths) {
              const keypairPath = path.replace('.so', '-keypair.json');
              console.log('[LOCAL_DEPLOY] Checking host path:', path);
              if (fs.existsSync(path) && fs.existsSync(keypairPath)) {
                foundPath = path;
                foundKeypairPath = keypairPath;
                console.log('[LOCAL_DEPLOY] Found artifacts on host at:', path);
                break;
              }
            }
            
            if (foundPath && foundKeypairPath) {
              console.log('[LOCAL_DEPLOY] Copying artifacts from host to container...');
              
              // Create target directory if it doesn't exist
              const targetDir = `/usr/src/${rootPath}/target/deploy`;
              const mkdirCmd = `docker exec ${containerName} mkdir -p "${targetDir}"`;
              await runCommand(mkdirCmd, '.', uuidv4(), { skipSuccessUpdate: true });
              
              // Copy artifacts to container
              const copySoCmd = `docker cp "${foundPath}" "${containerName}:${soFile}"`;
              const copyKeypairCmd = `docker cp "${foundKeypairPath}" "${containerName}:${keypairFile}"`;
              
              await runCommand(copySoCmd, '.', uuidv4(), { skipSuccessUpdate: true });
              await runCommand(copyKeypairCmd, '.', uuidv4(), { skipSuccessUpdate: true });
              
              // Verify copy succeeded
              const verifyCopyCmd = `docker exec ${containerName} test -f "${soFile}" && echo "exists" || echo "missing"`;
              const copyVerify = await runCommand(verifyCopyCmd, '.', uuidv4(), { skipSuccessUpdate: true });
              
              if (copyVerify.trim() === 'missing') {
                throw new Error('Failed to copy program artifacts to container');
              }
              
              console.log('[LOCAL_DEPLOY] Artifacts copied successfully');
            } else {
              // Last resort: look for any .so file in the container's project directory
              const findCmd = `docker exec ${containerName} find /usr/src -name "*.so" -type f 2>/dev/null | head -5`;
              const foundSo = await runCommand(findCmd, '.', uuidv4(), { skipSuccessUpdate: true });
              
              if (foundSo && foundSo.trim()) {
                console.log('[LOCAL_DEPLOY] Found .so files at:', foundSo.trim());
                throw new Error(`Program artifact not found at expected location. Found .so files at: ${foundSo.trim()}. Please check the program name in Anchor.toml matches the deployment configuration.`);
              } else {
                throw new Error('Program artifact not found. Please build the project first.');
              }
            }
          } else {
            throw new Error('ROOT_FOLDER not set, cannot locate artifacts');
          }
        }
      } else {
        console.log('[LOCAL_DEPLOY] Using existing build artifact from pipeline at:', soFile);
      }
      
      // Step 3: Get program ID from database or keypair
      let programId: string;
      
      // Try to get program ID from database first
      const result = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      if (result.rows[0]?.details?.projectState?.programId) {
        programId = result.rows[0].details.projectState.programId;
        console.log(`[LOCAL_DEPLOY] Using program ID from build: ${programId}`);
      } else {
        // Fall back to reading from keypair file
        const keypairExistsCmd = `docker exec ${containerName} test -f "${keypairFile}" && echo "exists" || echo "missing"`;
        const keypairExists = await runCommand(keypairExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        
        if (keypairExists.trim() === 'exists') {
          // Get existing program ID
          const getProgramIdCmd = `docker exec ${containerName} solana-keygen pubkey "${keypairFile}"`;
          programId = (await runCommand(getProgramIdCmd, '.', uuidv4(), { skipSuccessUpdate: true })).trim();
          console.log(`[LOCAL_DEPLOY] Using existing program ID from keypair: ${programId}`);
        } else {
          throw new Error('Program keypair not found. Please build the project first.');
        }
      }
      
      // Step 4: Configure Solana CLI with retry and verification
      console.log('[LOCAL_DEPLOY] Configuring Solana CLI for local validator...');
      const configCmd = `docker exec ${containerName} bash -c "
        # Set config with explicit localhost
        solana config set --url http://127.0.0.1:8899 &&
        solana config set --commitment confirmed &&
        
        # Verify the configuration works
        solana cluster-version --url http://127.0.0.1:8899
      "`;
      
      try {
        const configOutput = await runCommand(configCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        console.log('[LOCAL_DEPLOY] Solana CLI configured:', configOutput);
      } catch (err) {
        throw new Error(`Failed to configure Solana CLI: ${err}`);
      }
      
      // Step 4a: Ensure default signer exists
      const checkSignerCmd = `docker exec ${containerName} test -f /root/.config/solana/id.json && echo "exists" || echo "missing"`;
      const signerExists = await runCommand(checkSignerCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (signerExists.trim() === 'missing') {
        console.log('[LOCAL_DEPLOY] Creating default signer keypair...');
        const createSignerCmd = `docker exec ${containerName} solana-keygen new --no-bip39-passphrase -o /root/.config/solana/id.json --force`;
        await runCommand(createSignerCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      }
      
      // Step 4b: Airdrop SOL to the default signer
      const getSignerPubkeyCmd = `docker exec ${containerName} solana address`;
      const signerPubkey = (await runCommand(getSignerPubkeyCmd, '.', uuidv4(), { skipSuccessUpdate: true })).trim();
      console.log('[LOCAL_DEPLOY] Default signer pubkey:', signerPubkey);
      
      // Airdrop with retry logic
      for (let i = 0; i < 3; i++) {
        try {
          const airdropCmd = `docker exec ${containerName} solana airdrop 10 ${signerPubkey} --url http://127.0.0.1:8899`;
          await runCommand(airdropCmd, '.', uuidv4(), { skipSuccessUpdate: true });
          console.log('[LOCAL_DEPLOY] Airdropped 10 SOL to signer');
          break;
        } catch (err) {
          if (i === 2) {
            console.warn('[LOCAL_DEPLOY] Airdrop failed, but continuing (may already have balance)');
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // Step 5: Check if program is already deployed
      const checkDeployedCmd = `docker exec ${containerName} bash -c "
        solana program show ${programId} --url http://127.0.0.1:8899 2>&1 || echo 'not-found'
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
      
      // Double-check validator is still running before deployment
      await ensureValidatorRunning(containerName);
      
      let deployOutput: string;
      
      if (deploymentType === 'new') {
        // Initial deployment using anchor deploy with explicit URL
        const deployCmd = `docker exec ${containerName} bash -lc "
          cd ${programPath} &&
          # Set explicit cluster URL in Anchor.toml if needed
          sed -i 's/\\[provider\\]/[provider]\\ncluster = \"http:\\/\\/127.0.0.1:8899\"/' Anchor.toml 2>/dev/null || true &&
          
          # Deploy with explicit URL
          anchor deploy \\
            --program-name ${programName} \\
            --provider.cluster 'http://127.0.0.1:8899' \\
            --program-keypair "${keypairFile}"
        "`;
        
        deployOutput = await runCommand(deployCmd, '.', projectId);
      } else {
        // Upgrade using solana program deploy with explicit URL
        const upgradeCmd = `docker exec ${containerName} bash -c "
          solana program deploy \"${soFile}\" \\
            --program-id \"${keypairFile}\" \\
            --url http://127.0.0.1:8899 \\
            --commitment confirmed
        "`;
        
        deployOutput = await runCommand(upgradeCmd, '.', projectId);
      }
      
      // Step 7: Verify deployment
      const verifyCmd = `docker exec ${containerName} bash -c "
        solana program show ${programId} --url http://127.0.0.1:8899 | head -5
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