import path from "path";
import { runCommand } from "../command-execution/runCommand";
import { getContainerName } from "../container/getContainerName";
import { getProjectRootPath } from "../fileUtils";
import { createTask, updateTaskStatus } from "../taskUtils";

export const startAnchorDeployTask = async (
    projectId: string,
    creatorId: string,
    ephemeralPubkey?: string
  ): Promise<string> => {
    const taskId = await createTask('Anchor Deploy', creatorId, projectId);
    let programId: string | null = null;
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    
    if (ephemeralPubkey === 'SIGNED') {
      //console.log('[DEPLOY] signed-tx path – skipping container key copy and awaiting frontend deployment');
      await updateTaskStatus(sanitizedTaskId, 'doing', 'Waiting for signed transaction from wallet...');
      return sanitizedTaskId;
    }
  
    //console.log(`Starting anchor deploy for project ${projectId}`);
  
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
          //console.log(`[EPHEMERAL] Symlink created for ${rootPath}`);
        }
  
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url https://api.devnet.solana.com"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        
        let containerWalletPath;

        if (ephemeralPubkey) {
          // Ephemeral key should be in container at /usr/src/target/deploy/
          const containerKeyPath = `/usr/src/target/deploy/${ephemeralPubkey}.json`;

          // Check if key exists in container
          const keyExistsCmd = `docker exec ${containerName} test -f ${containerKeyPath} && echo "exists" || echo "missing"`;
          const keyExists = await runCommand(keyExistsCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });

          if (keyExists.trim() !== 'exists') {
            // Try to find it with the program name pattern
            const findKeyCmd = `docker exec ${containerName} find /usr/src/target/deploy -name "*-keypair.json" | head -1`;
            const foundKey = await runCommand(findKeyCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });

            if (foundKey.trim()) {
              containerWalletPath = foundKey.trim();
              console.log(`[DEPLOY] Found keypair at ${containerWalletPath}`);
            } else {
              console.error(`[DEPLOY_DEBUG] ERROR: Ephemeral key file not found in container`);
              throw new Error(`Ephemeral key file not found in container for ${ephemeralPubkey}`);
            }
          } else {
            containerWalletPath = containerKeyPath;
          }

          // Verify the key content
          try {
            const keyContentCmd = `docker exec ${containerName} cat ${containerWalletPath}`;
            const keyContent = await runCommand(keyContentCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const keyArray = JSON.parse(keyContent);
            if (keyArray.length !== 64) {
              console.warn(`[DEPLOY] Warning: Key file does not contain a 64-byte array`);
            }
          } catch (err: any) {
            console.error(`[DEPLOY] Error reading key file from container`);
            throw new Error(`Error reading key file: ${err.message}`);
          }
          
          try {
            const fileCheckCmd = `docker exec ${containerName} ls -la ${containerWalletPath}`;
            await runCommand(fileCheckCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            
            const pubkeyCmd = `docker exec ${containerName} bash -c "solana-keygen pubkey ${containerWalletPath} || echo 'KEYGEN_FAILED'"`;
            const pubkeyResult = await runCommand(pubkeyCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            
            if (pubkeyResult.trim() !== ephemeralPubkey) {
              console.error(`[DEPLOY] Key verification failed - public key mismatch`);
              throw new Error(`Ephemeral key verification failed. Expected: ${ephemeralPubkey}, Got: ${pubkeyResult.trim()}`);
            } else {
              console.log(`[DEPLOY] Ephemeral key verified successfully`);
            }
            
            const anchorTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml || echo 'ANCHOR_TOML_NOT_FOUND'"`;
            const anchorTomlContent = await runCommand(anchorTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            
            const walletLineMatch = anchorTomlContent.match(/wallet\s*=\s*["']([^"']+)["']/);
            if (walletLineMatch) {
              const walletPath = walletLineMatch[1];
              //console.log(`[DEPLOY_DEBUG] Found wallet setting in Anchor.toml: ${walletPath}`);
              
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
                  //console.log(`[DEPLOY_DEBUG] Updated Anchor.toml to use ephemeral key: ${containerWalletPath}`);
                  
                  const verifyTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml | grep wallet"`;
                  const verifyResult = await runCommand(verifyTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                  //console.log(`[DEPLOY_DEBUG] Verified Anchor.toml wallet setting: ${verifyResult.trim()}`);
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
          // Generate a new ephemeral key in the container for deployment
          containerWalletPath = `/tmp/deploy-wallet-${Date.now()}.json`;
          console.log(`[DEPLOY] Generating ephemeral deployment wallet in container`);

          // Generate a new keypair directly in the container
          const genKeyCmd = `docker exec ${containerName} solana-keygen new --no-bip39-passphrase -o ${containerWalletPath} --force`;
          await runCommand(genKeyCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });

          // Set it as the default keypair
          await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --keypair ${containerWalletPath}"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        }
        
              await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url devnet"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        // Remove any existing program keypair files to ensure a new Program ID on each deployment
        await runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && rm -f target/deploy/*-keypair.json"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
        //console.log(`[DEPLOY] Removed existing program keypair files to force fresh program ID`);
        
        const anchorDeployCmd = `anchor deploy -p ${programName} \
          --provider.wallet ${containerWalletPath} \
          --provider.cluster devnet`;
        
        //console.log(`Running deploy with wallet flag: --provider.wallet ${containerWalletPath}`);
        
        //console.log(`[EPHEMERAL_DEBUG] Checking Anchor.toml configuration...`);
        try {
          const anchorTomlCmd = `docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/Anchor.toml || echo 'ANCHOR_TOML_NOT_FOUND'"`;
          const anchorTomlContent = await runCommand(anchorTomlCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
          
          const walletMatch = anchorTomlContent.match(/wallet\s*=\s*["']([^"']+)["']/);
          if (walletMatch) {
            //console.log(`[EPHEMERAL_DEBUG] Found wallet in Anchor.toml: ${walletMatch[1]}`);
            
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
        //console.log(`[DEPLOY_DEBUG] Running command: ${deployCmd}`);
        
        const result = await runCommand(deployCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true }).catch(async (error: any) => {
          console.error('Error during deployment:', sanitizedTaskId, error);
          
          //console.log(`[EPHEMERAL_DEBUG] Deployment failed.`);
          // Fallback removed - modern Anchor only accepts --provider.wallet
          
          const errorResult = JSON.stringify({
            status: 'failed',
            error: error.message
          });
          await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
          return `Error: ${error.message}`;
        });
  
        //console.log(`[DEPLOY_DEBUG] Full deploy output (first 1000 chars):\n${result?.substring(0, 1000)}`);
  
        if (result && result.startsWith('Error:')) {
          console.error(`Deployment failed for Task ID: ${sanitizedTaskId}. Reason: ${result}`);
          const errorResult = JSON.stringify({
            status: 'failed',
            error: result
          });
          await updateTaskStatus(sanitizedTaskId, 'failed', errorResult);
          return;
        }
  
        //console.log(`[DEPLOY_DEBUG] Searching for Program Id in output...`);
        const programIdRegex = /Program Id:\s*([a-zA-Z0-9]{32,44})/;
        const programIdMatch = result?.match(programIdRegex);
        
        if (programIdMatch) {
         // console.log(`[DEPLOY_DEBUG] Found Program Id: ${programIdMatch[1]}`);
          programId = programIdMatch[1];
        } else {
          console.log(`[DEPLOY_DEBUG] WARNING: No Program Id found in output! Searching the entire output for base58-like strings...`);
          
          const base58Regex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
          const potentialIds = result?.match(base58Regex) || [];
          if (potentialIds.length > 0) {
            //console.log(`[DEPLOY_DEBUG] Found potential base58 program IDs: ${potentialIds.join(', ')}`);
            
            if (potentialIds.length > 0) {
              programId = potentialIds[0] || null;
              //console.log(`[DEPLOY_DEBUG] Using first potential base58 string as Program ID: ${programId}`);
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
  
        //console.log(`Deployed program ID: ${programId}`);
        
        //if (programId) console.log(`Program successfully deployed with ID: ${programId}`);
        
        try {
          if (programId && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
           // console.error(`[DEPLOY_DEBUG] ERROR: Invalid program ID format: ${programId}`);
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
         // console.log(`[DEPLOY_DEBUG] Program verification: ${checkProgramResult.substring(0, 500)}`);
          
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
         //   console.log(`[DEPLOY] Updated web/.env with Program ID: ${programId}`);
          } catch (updateErr: any) {
            console.error(`[DEPLOY] Failed to update web/.env: ${updateErr.message}`);
          }
        }
  
        const successResult = JSON.stringify({
          status: 'success',
          programId: programId
        });
        
       // console.log(`[DEPLOY_DEBUG] Final program ID to be returned to client: '${programId}'`);
       // console.log(`[DEPLOY_DEBUG] Task result JSON: ${successResult}`);
        
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
  