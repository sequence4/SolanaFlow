import fs from 'fs';
import { APP_CONFIG } from '../config/appConfig';
import { createTask, updateTaskStatus } from './taskUtils';
import path from 'path';
import { getProjectRootPath } from './fileUtils';
import { v4 as uuidv4 } from 'uuid';
import { normalizeProjectName } from './stringUtils';
import pool from 'src/config/database';
import { Connection, sendAndConfirmRawTransaction, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getContainerName } from './container/getContainerName';
import { runCommand } from './command-execution/runCommand';
import { findMissingSigners } from './blockchain/findMissingSigners';

export function hasWarning(output: string): boolean {
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

export async function compileTs(
  tsFileName: string,
  compileCwd: string,
  distFolder = "dist"
): Promise<string> {
  const taskId = uuidv4();

  const compileCmd = `npx tsc ${tsFileName} --outDir ${distFolder} --module commonjs --target ES2020 --esModuleInterop`;

  const compileOutput = await runCommand(compileCmd, compileCwd, taskId);
  //console.log("Compile output:", compileOutput);

  const baseName = path.basename(tsFileName, ".ts");
  const jsFileName = baseName + ".js";

  const jsFilePath = path.join(compileCwd, distFolder, jsFileName);

  if (!fs.existsSync(jsFilePath)) {
    const msg = `Compiled file not found at: ${jsFilePath}`;
    await updateTaskStatus(taskId, 'failed', msg);
    throw new Error(msg);
  }

  const compiledJs = fs.readFileSync(jsFilePath, "utf8");
  //console.log(`Read compiled JS from: ${jsFilePath}`);

  await updateTaskStatus(taskId, 'succeed', `Compiled ${tsFileName} -> ${jsFileName}`);

  return compiledJs;
}

function transformRootPath(rootPath: string): string {
  return rootPath.replace(/-/g, '_');
}

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
  //console.log(`Starting node dependency installation task for project ${projectId} with packages:`, packages);

  setImmediate(async () => {
    try {
      if (packages.length === 0) {
        //console.log(`No packages to install for project ${projectId}`);
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
      
      //console.log(`Found container ${containerName} for project ${projectId}`);
      
      await updateTaskStatus(taskId, 'doing', `Adding ${packages.join(', ')} to package.json in ${targetDir}...`);
      //console.log(`Adding packages to package.json: ${packages.join(', ')} for project ${projectId} in ${targetDir}`);
      
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
        
        //console.log(`Successfully added packages to package.json in ${containerName} (${targetDir})`);
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

// DEPRECIATED
/*
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
*/

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
  
  //console.log(`Found container ${containerName} for project ${projectId}`);
  
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




