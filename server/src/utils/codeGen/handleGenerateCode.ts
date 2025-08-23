import { refreshWorkspaceTree } from './refreshWorkspaceTree';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../container/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';
import { pollTaskStatus, createTask, updateTaskStatus, waitForTaskCompletion } from '../taskUtils';
import { markWriteDone } from '../taskUtils/index';
import { genSrcFiles } from './genSrcFiles';
import { insertSrcFiles } from './insertSrcFiles';
import { debugDumpContainerTree, debugPrintFiles } from '../container';
import { ensureAnchorTomlProgram, ensureRootWorkspaceMembers } from './ensureConfigHelpers';
import { parseNodeDetails } from './parseNodeDetails';
import { lintWorkspaceManifests } from './cargoManifestLint';
import { FileTreeItem } from '../../types/FileTreeItem';
import { runCommand } from "../command-execution/runCommand";
import { randomUUID } from 'crypto';
import path from "path";
import fs from 'fs/promises';           
import fsSync from 'fs';            
import { APP_CONFIG } from '../../config/appConfig';
import { Keypair } from '@solana/web3.js';
import pool from '../../config/database';
import { normalizeProjectName } from '../helpers/stringUtils';
import { saveProgramSecret, awsSecretsEnabled } from '../aws/awsSecrets';
import { ProgressManager } from '../progress/ProgressManager';
import { 
  Args,
  allGeneratedFiles
 } from './data';
import {
  flattenPaths,
  dirToFileTree,
  findWebDir,
  emitFileWritten
} from './helpers';


export const handleGenerateCode = async ({
  projectId,
  graph,
  workspace,
  sendProgress,
  userId,
}: Args): Promise<{ sentinelId: string; programName: string }> => {   
    const isDevServer = process.env.SF_DEV_SERVER === '1';
    allGeneratedFiles.length = 0; 
    
    try {
        const containerWebDir = `/usr/src/${workspace.rootPath}/web`;
        if (graph.nodes.length === 0) throw new Error('No nodes found');

        /*
        const functionParts = graph.nodes
          .map(n => {
            const maybeCode =
              (n as any).config?.code ??
              (n as any).data?.code ??
              null;

            return typeof maybeCode === 'string' ? maybeCode : null;
          })
          .filter(Boolean) as string[];
        */
        
        
        const fileTreeTaskIds = await refreshWorkspaceTree(projectId, userId);
        
        sendProgress({ message: 'Starting code generation...' });

        const treeTaskId = fileTreeTaskIds[0];
        const treeResult = await pollTaskStatus(treeTaskId);
        const initialTree = JSON.parse(treeResult.task.result ?? '[]');
        
        const existingFilePaths = new Set<string>(flattenPaths(initialTree));
        
        for (const f of [
          "web/package.json",               "./web/package.json",
          "web/tsconfig.json",              "./web/tsconfig.json",
          "web/tailwind.config.js",         "./web/tailwind.config.js",
          "web/src/components/ui/use-toast.ts",
          "./web/src/components/ui/use-toast.ts",
          "web/src/components/ui/toaster.tsx",
          "./web/src/components/ui/toaster.tsx",
        ]) {
          existingFilePaths.delete(f);
        }

        sendProgress({ message: 'Processing existing web files...' });

        const webRootDir = findWebDir();
        const creatorId   = userId;
        const uiTree      = await dirToFileTree(webRootDir, webRootDir); 

        sendProgress({ message: 'Processing UI files...' });

        const uiWriteTaskIds = await insertSrcFiles(
          uiTree,
          projectId,
          existingFilePaths,
          creatorId,
          emitFileWritten(sendProgress, false) 
        );
        
        sendProgress({ message: `Writing ${uiWriteTaskIds.length} UI files...` });
        
        for (let i = 0; i < uiWriteTaskIds.length; i++) {
          await waitForTaskCompletion(uiWriteTaskIds[i], 90, 2_000);
        }

        sendProgress({ message: 'UI files processed' });

        const containerRootDir = `/usr/src/${workspace.rootPath}`;   // <── NEW
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        sendProgress({ message: 'Installing dependencies...' });

        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'rm -f ${containerRootDir}/web/.yarnrc'`,
          '.',
          projectId,
        );

        {
          sendProgress({ message: 'Generating yarn.lock...' });

          const lockfileCmd = [
            'docker exec',
            '-e', 'YARN_CACHE_FOLDER=/tmp/yarn-cache',
            '-w', containerRootDir,
            workspace.containerName,
            'bash -lc "rm -rf \\$YARN_CACHE_FOLDER && mkdir -p \\$YARN_CACHE_FOLDER && ' +
              'yarn --cwd web install --lockfile-only --network-timeout 600000"'
          ].join(' ');

          await runCommand(lockfileCmd, '.', projectId);
          sendProgress({ message: 'Lockfile created' });

          sendProgress({ message: 'Installing dependencies...' });
          
          const installCmd = [
            'docker exec',
            '-e', 'YARN_CACHE_FOLDER=/tmp/yarn-cache',
            '-w', containerRootDir,
            workspace.containerName,
            'bash -lc "mkdir -p \\$YARN_CACHE_FOLDER && ' +
              'yarn --cwd web install --prefer-offline --network-timeout 600000"'
          ].join(' ');

          await runCommand(installCmd, '.', projectId);
          
          sendProgress({ message: 'Dependencies installed' });
        }

        sendProgress({ message: 'Restarting Next.js server...' });

        await runCommand(
          `docker exec ${workspace.containerName} pkill -f '.next/standalone/server.js' || true`,
          '.',
          projectId,
        );

        sendProgress({ message: isDevServer 
          ? 'Dev server detected – no restart needed' 
          : 'Dev server will start via CMD'
        });


        if (!isDevServer) {
          sendProgress({ message: 'Building Next.js application...' });
          try {
            await runCommand(
              `docker exec ${workspace.containerName} bash -lc 'cat > ${containerWebDir}/tsconfig.json <<EOF
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "node",
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": "src",
    "paths": { "@/*": ["*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF'`,
              '.', 
              projectId
            );
            
            await runCommand(
              `docker exec \
 -e NEXT_PRIVATE_STANDALONE=true \
 -e APP_BASE_PATH=/dapp/$APP_ID \
 -w ${containerWebDir} \
 ${workspace.containerName} npm run build`,
              '.',
              projectId
            );
            sendProgress({ message: 'Next.js build completed' });
          } catch (error) {
            console.error('Error during Next.js build:', error);
            sendProgress({ message: '⚠️ Next.js build failed (non-critical)' });
          }
        } 

        sendProgress({ message: 'Building source tree...' });
        
        const rootStem   = workspace.rootPath.replace(/-[a-f0-9]{8}$/, '');
        let programName  = rootStem.replace(/-/g, '_');
        if (/^[0-9]/.test(programName)) programName = 'p' + programName;
        try {
          const nameRes = await pool.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
          const projName: string | undefined = nameRes.rows[0]?.name;
          if (projName) {
            programName = normalizeProjectName(projName);
          }
          programName = programName.replace(/-/g, '_');
        } catch (e) {
          console.warn('Could not fetch project name, using default:', e);
        }
        
        sendProgress({ message: 'Generating program keypair...' });
        const programKeypair = Keypair.generate();
        const programId = programKeypair.publicKey.toBase58();

        if (awsSecretsEnabled()) {
          await saveProgramSecret(programId, programKeypair.secretKey);
        } else {
          console.warn('[GEN] AWS secrets disabled – keypair kept only on disk');
        }

        const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${programId}.json`);
        fsSync.writeFileSync(walletPath, JSON.stringify(Array.from(programKeypair.secretKey)));

        const initialKeyJson = JSON.stringify(Array.from(programKeypair.secretKey));
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && echo ${initialKeyJson.replace(/'/g, "'\\''")} > /usr/src/target/deploy/${programName}-keypair.json'`,
          '.',
          randomUUID(),
          { skipSuccessUpdate: true },
        );

        const crateSnake = programName.replace(/-/g, "_");
        const crateKebab = programName.replace(/_/g, "-");
        const copyKeypairCmd =
          programName === crateSnake
            ? "true"
            : `cp -f /usr/src/target/deploy/${programName}-keypair.json /usr/src/target/deploy/${crateSnake}-keypair.json`;

        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ${copyKeypairCmd}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );
        
        const copyKebabKeypairCmd =
          programName === crateKebab
            ? "true"
            : `cp -f /usr/src/target/deploy/${programName}-keypair.json /usr/src/target/deploy/${crateKebab}-keypair.json`;
            
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ${copyKebabKeypairCmd}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );

        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'cd /usr/src/${workspace.rootPath} && anchor keys sync'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );

        const derivedPubkey = Keypair.fromSecretKey(programKeypair.secretKey).publicKey.toBase58();
        if (derivedPubkey !== programId) {
          throw new Error('Keypair self-verification failed');
        }

        try {
          await pool.query(
            `
            UPDATE solanaproject
            SET    details =
                   jsonb_set(
                     COALESCE(details, '{}'::jsonb),
                     '{projectState,programId}',
                     to_jsonb($1::text),
                     true
                   )
            WHERE  id = $2
            `,
            [programId, projectId],
          );

          await pool.query(
            "UPDATE solanaproject \
               SET details = COALESCE(details, '{}'::jsonb) \
                            || $1::jsonb \
             WHERE id = $2",
            [JSON.stringify({ lastProgramId: programId }), projectId],
          );
 
          sendProgress({ stage: 'programIdPersisted', programId });
        } catch (e) {
          console.error('[GEN] Failed to persist program ID to DB:', e);
        }
        
        const keypairJson = JSON.stringify(Array.from(programKeypair.secretKey));
        const snakeKeyFile = `${crateSnake}-keypair.json`;
        const kebabKeyFile = `${crateKebab}-keypair.json`;
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'mkdir -p /usr/src/target/deploy && ` +
          `echo ${JSON.stringify(keypairJson)} | tee /usr/src/target/deploy/${snakeKeyFile} > /usr/src/target/deploy/${kebabKeyFile}'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true }
        );
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc ` +
          `'find /usr/src/target/deploy -maxdepth 1 -type f \\( ` +
            `-name "anchor_template-*-keypair.json" -o ` +
            `-name "my_program-*-keypair.json"    -o ` +
            `-name "my-program-*-keypair.json" \\) -delete'`,
          ".",
          randomUUID(),
          { skipSuccessUpdate: true },
        );
        
        sendProgress({ stage: 'ephemeralKey', pubkey: programId });
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc 'echo NEXT_PUBLIC_PROGRAM_ID=${programId} >> /usr/src/${workspace.rootPath}/web/.env'`,
          '.',
          `inject-env-${Date.now()}`,
          { skipSuccessUpdate: true },
        );
        
        await ensureAnchorTomlProgram(
          workspace,
          programName,
          programId,
          projectId,
          null
        );

        await ensureRootWorkspaceMembers(
          workspace,
          projectId,
          null
        );

        const projectState = { nodes: graph.nodes, edges: graph.edges || [] };
        const srcTree = genSrcFiles(projectState, programName, programId);
        if (!srcTree) throw new Error('genSrcFiles returned null');
        
        const { instructions: canonicalInstructions, state: canonicalState } = parseNodeDetails(projectState);
        sendProgress({ message: 'Extracting generated files...' });
        allGeneratedFiles.length = 0;
        
        const extractAllFiles = (node: FileTreeItem, basePath: string = ''): Array<{path: string, content: string}> => {
          const files: Array<{path: string, content: string}> = [];
          
          const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
          
          if (node.type === 'file' && node.code) {
            files.push({ path: currentPath, content: node.code });
          }
          
          if (node.children) {
            for (const child of node.children) {
              files.push(...extractAllFiles(child, currentPath));
            }
          }
          
          return files;
        };

        const writeFilesAndEmitTree = (
          rootNode: FileTreeItem,
          projectId: string,
          creatorId: string | null,
          _workspace: WorkspaceHandle,
          sendProgress: (d: unknown) => void,
        ): Promise<string> => {
          return (async () => {
            const allSrcFiles = extractAllFiles(rootNode);
            sendProgress({ message: `Writing ${allSrcFiles.length} program files...` });
            const writeTaskIds = await insertSrcFiles(rootNode, projectId, existingFilePaths, creatorId, emitFileWritten(sendProgress, true));
            sendProgress({ message: 'Saving files to container...' });
            for (let i = 0; i < writeTaskIds.length; i++) {
              await waitForTaskCompletion(writeTaskIds[i], 90, 2_000);
            }
            /*
            const displayFiles = allSrcFiles.slice(0, 5).map(file => ({
              filename: file.path,
              content: file.content.substring(0, 500),
              language: file.path.endsWith('.rs') ? 'rust' : 'toml'
            }));
            */
            sendProgress({ message: `Generated ${allSrcFiles.length} Solana program files` });

            const sentinelId = await markWriteDone(projectId);
            return sentinelId;
          })();
        };
        
        const sentinelId = await writeFilesAndEmitTree(
          srcTree,
          projectId,
          null,
          workspace,
          sendProgress,
        );

        sendProgress({ message: 'Validating Cargo manifests...' });

        lintWorkspaceManifests({ projectId, userId, workspace })
          .then(() =>
            sendProgress({ message: "Cargo manifests validated" })
          )
          .catch(err =>
            sendProgress({ message: `Manifest validation failed: ${String(err)}` })
          );

        sendProgress({ message: 'Updating configuration files...' });

        await amendConfigFiles(projectId, userId);
        sendProgress({ message: 'Code generation complete' });

        await new Promise(resolve => setTimeout(resolve, 500));

        sendProgress({ message: 'Starting build process...' });
        
        sendProgress({ message: 'Cleaning previous builds...' });
        
        const WORKDIR   = `/usr/src/${workspace.rootPath}`;
        const KEYS_DIR  = `target/deploy`;
        const snakeKey  = `${crateSnake}-keypair.json`;  // anchor_template-keypair.json
        const kebabKey  = `${crateKebab}-keypair.json`;  // anchor-template-keypair.json

        const keyJsonEsc = keypairJson.replace(/'/g, `'\\''`);

        const script = [
          `cd ${WORKDIR}`,
          'anchor clean',
          `mkdir -p ${KEYS_DIR}`,
          `echo '${keyJsonEsc}' | tee ${KEYS_DIR}/${snakeKey} > ${KEYS_DIR}/${kebabKey}`,
          `anchor keys sync`,
          `anchor build -p ${programName}`
        ].join(' && ');

        sendProgress({ message: 'Syncing program keys...' });
        sendProgress({ message: 'Compiling Rust program...' });
        
        await runCommand(
          `docker exec ${workspace.containerName} bash -lc "${script}"`,
          '.',
          projectId
        );
        
        sendProgress({ message: 'Program built successfully' });
        
        // Extract and save IDL after successful build
        try {
          sendProgress({ message: 'Extracting IDL...' });
          
          const idlPath = `${WORKDIR}/target/idl/${programName}.json`;
          const extractIdlCmd = `docker exec ${workspace.containerName} bash -lc 'cat ${idlPath}'`;
          
          const idlContent = await runCommand(extractIdlCmd, '.', projectId, { skipSuccessUpdate: true, silent: true });
          
          if (idlContent && idlContent.trim()) {
            const idl = JSON.parse(idlContent);
            
            // Ensure IDL has the program address
            if (!idl.metadata?.address) {
              idl.metadata = { 
                ...idl.metadata, 
                address: programId 
              };
            }
            
            // Save IDL to project details
            await pool.query(
              `UPDATE solanaproject 
               SET details = jsonb_set(
                 jsonb_set(
                   COALESCE(details, '{}'::jsonb),
                   '{projectState,idl}',
                   $1::jsonb,
                   true
                 ),
                 '{projectState,idls}',
                 COALESCE(details->'projectState'->'idls', '[]'::jsonb) || $1::jsonb,
                 true
               )
               WHERE id = $2`,
              [JSON.stringify(idl), projectId]
            );
            
            sendProgress({ 
              message: 'IDL extracted and saved',
              idl: idl 
            });
            
            console.log(`[BUILD] IDL extracted successfully for program ${programId}`);
          }
        } catch (idlError) {
          console.warn('[BUILD] IDL extraction failed (non-critical):', idlError);
          sendProgress({ message: 'Warning: IDL extraction failed (program will still work)' });
        }

        const dumpTaskId = await createTask(
            'Dump Container Tree', null, projectId);
        try {
          await debugDumpContainerTree(
            workspace.containerName,
            workspace.rootPath,
            dumpTaskId,
          );
        } finally {
          try {
            const important = [
              "Anchor.toml",
              "Cargo.toml",
              `programs/${programName}/src/lib.rs`,
              `programs/${programName}/src/instructions/mod.rs`,
              ...canonicalInstructions.map(i => `programs/${programName}/src/instructions/${i.name}.rs`),
            ];
            if (canonicalState.length > 0) {
              important.push(`programs/${programName}/src/state.rs`);
            }

            await debugPrintFiles(
              workspace.containerName,
              workspace.rootPath,
              important,
              dumpTaskId,
            );
          } catch (e) {
            console.warn("[DEBUG] failed to print file contents:", e);
          }
          await updateTaskStatus(dumpTaskId, 'succeed', 'Tree dumped and files printed');
        }
                
        return { sentinelId, programName };
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        sendProgress({ message: `Error: ${err instanceof Error ? err.message : String(err)}` });
        throw err;
    }
};