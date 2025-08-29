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
      // Symlink target/idl to target/deploy (Anchor expects this)
      await runCommand(
        `docker exec ${containerName} bash -c '[ ! -e /usr/src/${rootPath}/target/idl ] && ln -sfnT /usr/src/${rootPath}/target/deploy /usr/src/${rootPath}/target/idl || true'`,
        '.',
        projectId,
        { skipSuccessUpdate: true },
      );
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