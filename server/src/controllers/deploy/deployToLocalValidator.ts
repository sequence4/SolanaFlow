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
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[LOCAL_DEPLOY] Checking validator health (attempt ${attempt}/${maxAttempts})...`);
    
    // Check if validator process exists
    const psCmd = `docker exec ${containerName} pgrep -f solana-test-validator || echo "not-running"`;
    const psResult = await runCommand(psCmd, '.', uuidv4(), { skipSuccessUpdate: true });
    
    if (psResult.trim() === "not-running") {
      console.log('[LOCAL_DEPLOY] Validator not running, starting it...');
      
      // Start validator with proper options for reliability
      const startCmd = `docker exec ${containerName} bash -c "
        # Kill any existing validator processes
        pkill -f solana-test-validator || true
        sleep 1
        
        # Start validator in background with proper logging
        solana-test-validator \\
          --reset \\
          --bind-address 0.0.0.0 \\
          --rpc-port 8899 \\
          --ws-port 8900 \\
          --faucet-port 9900 \\
          --log /tmp/validator.log \\
          > /tmp/validator-stdout.log 2>&1 &
        
        # Wait for validator to start
        echo 'Waiting for validator to start...'
        for i in {1..30}; do
          if solana cluster-version --url http://127.0.0.1:8899 2>/dev/null; then
            echo 'Validator is ready!'
            exit 0
          fi
          sleep 1
        done
        
        # If we get here, validator failed to start
        echo 'Validator failed to start. Logs:'
        cat /tmp/validator-stdout.log | tail -20
        exit 1
      "`;
      
      try {
        const validatorOutput = await runCommand(startCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        console.log('[LOCAL_DEPLOY] Validator started:', validatorOutput);
      } catch (err) {
        console.error('[LOCAL_DEPLOY] Failed to start validator:', err);
        if (attempt === maxAttempts) {
          throw new Error(`Validator failed to start after ${maxAttempts} attempts: ${err}`);
        }
      }
    }
    
    // Test connection
    const testCmd = `docker exec ${containerName} bash -c "
      solana cluster-version --url http://127.0.0.1:8899 2>&1
    "`;
    
    try {
      const result = await runCommand(testCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      if (result.includes('solana-core')) {
        console.log('[LOCAL_DEPLOY] Validator is healthy');
        
        // Verify connection with JSON-RPC
        const verifyConnectionCmd = `docker exec ${containerName} bash -c "
          curl -s -X POST http://127.0.0.1:8899 -H 'Content-Type: application/json' \\
            -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getHealth\"}' || echo 'Connection failed'
        "`;
        
        const connectionCheck = await runCommand(verifyConnectionCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        if (connectionCheck.includes('failed')) {
          throw new Error('Validator is not accessible on port 8899');
        }
        
        return;
      }
    } catch (err) {
      console.warn(`[LOCAL_DEPLOY] Validator health check failed on attempt ${attempt}:`, err);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  throw new Error('Failed to start validator after multiple attempts');
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
      
      // Step 2: Get program details from the already-built artifacts
      const rootPath = await getProjectRootPath(projectId);
      const programPath = `/usr/src/${rootPath}`;
      
      // Get the program name from Anchor.toml
      const getProgramNameCmd = `docker exec ${containerName} bash -c "cd ${programPath} && grep '^\\[programs.localnet\\]' -A 1 Anchor.toml | grep -oP '^\\w+' | tail -1"`;
      const programName = (await runCommand(getProgramNameCmd, '.', uuidv4(), { skipSuccessUpdate: true }))
        .trim() || 'solanaflow';
      
      console.log(`[LOCAL_DEPLOY] Program name: ${programName}`);
      
      // The artifacts are in the warm cache location
      const soFile = `/usr/src/target/deploy/${programName}.so`;
      const keypairFile = `/usr/src/target/deploy/${programName}-keypair.json`;
      
      // Verify the .so file exists (it should from the build pipeline)
      const soExistsCmd = `docker exec ${containerName} test -f ${soFile} && echo "exists" || echo "missing"`;
      const soExists = await runCommand(soExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      if (soExists.trim() === 'missing') {
        throw new Error('Program artifact not found. Please build the project first.');
      }
      
      console.log('[LOCAL_DEPLOY] Using existing build artifact from pipeline');
      
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
        const keypairExistsCmd = `docker exec ${containerName} test -f ${keypairFile} && echo "exists" || echo "missing"`;
        const keypairExists = await runCommand(keypairExistsCmd, '.', uuidv4(), { skipSuccessUpdate: true });
        
        if (keypairExists.trim() === 'exists') {
          // Get existing program ID
          const getProgramIdCmd = `docker exec ${containerName} solana-keygen pubkey ${keypairFile}`;
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
            --program-keypair ${keypairFile}
        "`;
        
        deployOutput = await runCommand(deployCmd, '.', projectId);
      } else {
        // Upgrade using solana program deploy with explicit URL
        const upgradeCmd = `docker exec ${containerName} bash -c "
          solana program deploy ${soFile} \\
            --program-id ${keypairFile} \\
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