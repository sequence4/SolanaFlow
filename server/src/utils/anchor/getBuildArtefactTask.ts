import { Keypair } from "@solana/web3.js/lib";
import { getContainerName } from "../container/getContainerName";
import { getProjectRootPath } from "../fileUtils";
import { runCommand } from "../command-execution/runCommand";
import { v4 as uuidv4 } from 'uuid';

export const getBuildArtifactTask = async (projectId: string): Promise<{ status: string, base64So: string, programId?: string, programKeypair?: string }> => {
  try {
    const rootPath = await getProjectRootPath(projectId);
    
    // Get the container name for this project
    const containerName = await getContainerName(projectId);
    if (!containerName) {
      throw new Error(`No container found for project ${projectId}`);
    }
    
    // Create a temporary task ID for the command execution
    const tempTaskId = uuidv4();
    
    // find the first .so inside the correct target directory
    const locateCmd = `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && SO_DIR="\${CARGO_TARGET_DIR:-target}/deploy" && find "$SO_DIR" -maxdepth 1 -name "*.so" | head -n 1'`;
    const containerSoPath = (await runCommand(locateCmd, '.', tempTaskId, { skipSuccessUpdate: true })).trim();

    if (!containerSoPath) {
      console.error('[ARTIFACT] No program artifact (.so) found in container');
      throw new Error('Built artifact not found in container');
    }
    
    // Read and encode the file directly from the container
    const base64Cmd = `docker exec ${containerName} bash -c "cat '${containerSoPath}' | base64 -w 0"`;
    const base64So = await runCommand(
      base64Cmd,
      '.',
      tempTaskId,
      { skipSuccessUpdate: true, silent: true }
    );
    
    // Validate the binary data integrity
    const testBinary = Buffer.from(base64So, 'base64');
    if (testBinary.length < 4 || 
        testBinary[0] !== 0x7f || 
        testBinary[1] !== 0x45 || 
        testBinary[2] !== 0x4c || 
        testBinary[3] !== 0x46) {
      console.error(`[ARTIFACT] Invalid ELF file from ${containerSoPath}`);
      console.error(`[ARTIFACT] Binary header: [${testBinary.slice(0, 4).join(',')}]`);
      console.error(`[ARTIFACT] Binary size: ${testBinary.length} bytes`);
      
      // Also check the raw file in the container for debugging
      const hexCmd = `docker exec ${containerName} bash -c "head -c 16 '${containerSoPath}' | hexdump -C"`;
      try {
        const hexOutput = await runCommand(hexCmd, '.', tempTaskId, { skipSuccessUpdate: true });
        console.error(`[ARTIFACT] Raw file hex dump: ${hexOutput}`);
      } catch (e) {
        console.error(`[ARTIFACT] Could not read raw file: ${e}`);
      }
      
      throw new Error(`Invalid ELF file: corrupted program artifact at ${containerSoPath}`);
    }
    
    // Additional validation: Check if this looks like a minimal valid program
    if (testBinary.length < 100) {
      console.warn(`[ARTIFACT] Suspiciously small program: ${testBinary.length} bytes`);
    }
    
    //console.log(`[ARTIFACT] Valid ELF artifact verified: ${containerSoPath} (${testBinary.length} bytes)`);
    
    /* ----------------------------------------------------------------
       Locate the program keypair JSON.
       ① project‑local   target/deploy/        (fresh build output)
       ② warm‑cache      /usr/src/target/deploy (persists across builds)
       ---------------------------------------------------------------- */
    let containerKeypairPath = '';

    /* search the project-local target/deploy, but ignore template artefacts */
    const locateJsonCmdProject =
      `docker exec ${containerName} bash -c 'cd /usr/src/${rootPath} && ` +
      `find target/deploy -maxdepth 1 -name "*-keypair.json" ` +
      `! -name "anchor_template-*" ! -name "my_program-*"` +
      ` | head -n 1'`;

    containerKeypairPath = (
      await runCommand(locateJsonCmdProject, '.', tempTaskId, { skipSuccessUpdate: true })
    ).trim();

    if (!containerKeypairPath) {
      /* warm‑cache fallback, same exclusion rules */
      const locateJsonCmdGlobal =
        `docker exec ${containerName} bash -c 'find /usr/src/target/deploy -maxdepth 1 ` +
        `-name "*-keypair.json" ! -name "anchor_template-*" ! -name "my_program-*"` +
        ` | head -n 1'`;

      containerKeypairPath = (
        await runCommand(locateJsonCmdGlobal, '.', tempTaskId, { skipSuccessUpdate: true })
      ).trim();
    }

    if (!containerKeypairPath) {
      console.error('[ARTIFACT] No program keypair found in container');
      throw new Error('Program keypair not found in container');
    }
    
    const keypairJson = await runCommand(`docker exec ${containerName} bash -c "cat '${containerKeypairPath}'"`, '.', tempTaskId, { skipSuccessUpdate: true });
    let programId = "";
    try {
      const secretKeyBytes: number[] = JSON.parse(keypairJson.trim());
      if (!Array.isArray(secretKeyBytes) || secretKeyBytes.length !== 64) {
        throw new Error('Invalid keypair format (expected 64-byte array)');
      }
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyBytes));
      programId = keypair.publicKey.toBase58();
    } catch (e) {
      console.error('[ARTIFACT] Failed to parse keypair or derive programId');
    }
    
    return { status: 'success', base64So, programId, programKeypair: keypairJson.trim() };
  } catch (error) {
    console.error('[ARTIFACT] Error retrieving built artifact:', error);
    return { status: 'failed', base64So: '' };
  }
};