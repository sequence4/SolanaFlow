import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getContainerName } from "../../utils/container/getContainerName";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import { getProjectRootPath } from '../../utils/fileUtils';
import pool from "src/config/database";


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
          # Remove existing symlinks that may conflict with anchor build
          rm -f target/deploy 2>/dev/null || true &&
          rm -f target/idl 2>/dev/null || true &&
          mkdir -p target &&
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