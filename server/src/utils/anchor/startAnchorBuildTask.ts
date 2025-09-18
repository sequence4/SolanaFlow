import { createTask } from "../taskUtils";
import { getContainerName } from "../container/getContainerName";
import { getProjectRootPath } from "../fileUtils";
import pool from "src/config/database";
import path from "path";
import fs from "fs";
import { runCommand } from "../command-execution/runCommand";
import { updateTaskStatus } from "../taskUtils";
import { APP_CONFIG } from "src/config/appConfig";
import { Keypair } from "@solana/web3.js";
import { runSpawn } from "../command-execution/runSpawn";

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
      
      // ────────────────────────── Use **this project's** deterministic keypair ──────────────────────────
      /* -----------------------------------------------------------------
       * 1️⃣  primary → details.lastProgramId
       * 2️⃣  fallback → details.projectState.programId  (legacy field)
       * ---------------------------------------------------------------- */
      let res = await pool.query(
        "SELECT details->>'lastProgramId' AS pid \
           FROM solanaproject WHERE id = $1",
        [projectId],
      );
      let programId: string | undefined = res?.rows?.[0]?.pid ?? undefined;

      if (!programId) {
        const alt = await pool.query(
          "SELECT details->'projectState'->>'programId' AS pid \
             FROM solanaproject WHERE id = $1",
          [projectId],
        );
        programId = alt?.rows?.[0]?.pid ?? undefined;
      }

      if (!programId) {
        throw new Error(
          "Could not locate programId in project.details – run the code‑generation step first",
        );
      }

      const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${programId}.json`);

      /* ── 1️⃣ fail‑fast: the file must exist & be readable ── */
      try {
        await fs.promises.access(walletPath, fs.constants.R_OK);
      } catch {
        throw new Error(`Program keypair file not readable at ${walletPath}`);
      }

      /* ── 2️⃣ parse + sanity‑check ── */
      const secretJson  = await fs.promises.readFile(walletPath, 'utf8');
      const secretArr: number[] = JSON.parse(secretJson);
      if (!Array.isArray(secretArr) || secretArr.length !== 64) {
        throw new Error(
          `Invalid keypair format in ${walletPath} (expected 64‑byte array)`,
        );
      }
      const derivedPubkey = Keypair
        .fromSecretKey(Uint8Array.from(secretArr))
        .publicKey
        .toBase58();
      if (derivedPubkey !== programId) {
        throw new Error(
          `Keypair ${walletPath} pubkey ${derivedPubkey} ≠ expected Program ID ${programId}`,
        );
      }

      const containerKeyPath = `/usr/src/${rootPath}/target/deploy/${programName}-keypair.json`;
      await runCommand(
        `docker exec ${containerName} bash -c 'mkdir -p /usr/src/${rootPath}/target/deploy'`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
      // Create target directories first
      await runCommand(
        `docker exec ${containerName} bash -c 'mkdir -p /usr/src/${rootPath}/target/idl && mkdir -p /usr/src/${rootPath}/target/deploy'`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );

      console.log(`[BUILD] Target directories created for IDL and deploy artifacts`);
      // copy keypair into container for Anchor deploy
      await runCommand(
        `docker cp ${walletPath} ${containerName}:${containerKeyPath}`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
      //console.log(`[BUILD] Copied program keypair to container for program ${programId}`);
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

echo "[BUILD] Starting Anchor build for program: ${programName}"
echo "[BUILD] Program ID: ${programId}"
echo "[BUILD] Current directory: $(pwd)"
echo "[BUILD] Checking Anchor version..."
anchor --version || echo "[BUILD] Warning: anchor version check failed"

# Ensure target directories exist
mkdir -p target/deploy
mkdir -p target/idl

# Build the program with explicit IDL generation
echo "[BUILD] Building program with IDL generation..."
anchor build -p ${programName} -- --jobs 1 2>&1 | tee /tmp/build.log

# Check if IDL was generated during build
echo "[BUILD] Checking for generated IDL..."
if [ -f "target/idl/${programName}.json" ]; then
  echo "[BUILD] IDL found at target/idl/${programName}.json"
  ls -la target/idl/${programName}.json
  echo "[BUILD] IDL content preview:"
  head -c 500 target/idl/${programName}.json
else
  echo "[BUILD] IDL not found after build, attempting alternate generation methods..."

  # Method 1: Try using anchor idl build
  echo "[BUILD] Attempting 'anchor idl build' command..."
  anchor idl build -p ${programName} -o target/idl/${programName}.json 2>&1 || echo "[BUILD] 'anchor idl build' failed or not available"

  # Method 2: Try extracting from the built .so file
  if [ -f "target/deploy/${programName}.so" ]; then
    echo "[BUILD] Found .so file, attempting IDL extraction..."
    # Note: 'anchor idl parse' doesn't exist, but 'anchor idl fetch' might work for deployed programs
    # For now, we'll create a minimal IDL if none exists
  fi
fi

# Double-check IDL directories and create symlinks if needed
echo "[BUILD] Checking IDL locations..."
ls -la target/idl/ 2>/dev/null || echo "[BUILD] target/idl directory empty or doesn't exist"
ls -la target/deploy/*.json 2>/dev/null || echo "[BUILD] No JSON files in target/deploy"

# If still no IDL, create a minimal one for testing
if [ ! -f "target/idl/${programName}.json" ]; then
  echo "[BUILD] Creating minimal IDL for program interaction..."
  cat > "target/idl/${programName}.json" << EOF
{
  "version": "0.1.0",
  "name": "${programName}",
  "instructions": [],
  "accounts": [],
  "types": [],
  "metadata": {
    "address": "${programId}"
  }
}
EOF
  echo "[BUILD] Created minimal IDL at target/idl/${programName}.json"
  echo "[BUILD] Minimal IDL contents:"
  cat "target/idl/${programName}.json"
fi

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
      
      //console.log(`[BUILD] Created build script locally at ${tempDir}`);

      console.log(`[BUILD] Starting anchor build for project ${projectId}`);
      
      try {
        await updateTaskStatus(sanitizedTaskId, 'doing', 'Anchor build in progress...');
        
        // Prepare build script
        await runCommand(
          `docker cp ${buildScriptPath} ${containerName}:/tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );
        
        await runCommand(
          `docker exec ${containerName} chmod +x /tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );
        
        console.log(`[BUILD] Executing anchor build in container`);
        /*
        const buildOutput = await runSpawn(
          `docker exec ${containerName} /bin/bash /tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { sendProgress: d => console.log('[ANCHOR_BUILD]', (d as any).message?.trim() ?? '') }
        );
        */
        
        // Execute the build script
        console.log(`[BUILD] Running build script...`);
        const buildOutput = await runCommand(
          `docker exec ${containerName} /bin/bash /tmp/build.sh`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: false }
        );

        console.log(`[BUILD] Build output:`, buildOutput);

        // Check for .so file to verify build success
        const soFileCheck = await runCommand(
          `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy" && if ls "$SO_DIR"/*.so 1>/dev/null 2>&1; then echo "BUILD_SUCCESS"; else echo "BUILD_FAILURE"; fi'`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );

        // Check for IDL file generation
        const idlFileCheck = await runCommand(
          `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && if [ -f "target/idl/${programName}.json" ]; then echo "IDL_FOUND"; cat "target/idl/${programName}.json" | head -c 200; else echo "IDL_NOT_FOUND"; fi'`,
          '.',
          sanitizedTaskId,
          { skipSuccessUpdate: true }
        );

        console.log(`[BUILD] IDL check result:`, idlFileCheck);
        
        try {
          fs.unlinkSync(buildScriptPath);
        } catch (cleanupError: any) {
          console.log(`[BUILD] Non-critical error cleaning up temp files: ${cleanupError.message}`);
        }
        
        if (soFileCheck.includes('BUILD_SUCCESS')) {
          console.log("[BUILD] Anchor build completed successfully");
          await updateTaskStatus(sanitizedTaskId, 'succeed', `Build completed successfully. .so file was created.`);
        } else if (soFileCheck.includes('BUILD_FAILURE')) {
          //console.error("[BUILD] Build finished but no .so file was created");
          await updateTaskStatus(sanitizedTaskId, 'failed', `Build finished but no .so file was created`);
        }
        // no 'else' – runSpawn already set 'warning' when appropriate
      } catch (buildError: any) {
        console.error(`[BUILD] Anchor build failed`);
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