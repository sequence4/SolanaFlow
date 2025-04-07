"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInstallNodeDependenciesTask = exports.startProjectContainer = exports.closeProjectContainer = exports.startCreateProjectDirectoryTask = exports.startInstallPackagesTask = exports.startCustomCommandTask = exports.startAnchorTestTask = exports.startAnchorDeployTask = exports.startAnchorBuildTask = exports.getBuildArtifactTask = exports.startSetClusterTask = exports.startAnchorInitTask = void 0;
exports.runCommand = runCommand;
exports.compileTs = compileTs;
exports.runUserProjectCode = runUserProjectCode;
exports.getContainerName = getContainerName;
const fs_1 = __importDefault(require("fs"));
const appConfig_1 = require("../config/appConfig");
const taskUtils_1 = require("./taskUtils");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fileUtils_1 = require("./fileUtils");
const uuid_1 = require("uuid");
const stringUtils_1 = require("./stringUtils");
const database_1 = __importDefault(require("../config/database"));
const templateFiles_1 = require("../data/templateFiles");
function hasWarning(output) {
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
function runCommand(command_1, cwd_1, taskId_1) {
    return __awaiter(this, arguments, void 0, function* (command, cwd, taskId, options = {}) {
        return new Promise((resolve, reject) => {
            if (options.ensureDir) {
                try {
                    const mkdirCmd = `mkdir -p "${options.ensureDir}"`;
                    console.log(`[DEBUG_DIR] Creating directory: ${options.ensureDir}`);
                    (0, child_process_1.execSync)(mkdirCmd, { stdio: 'pipe' });
                }
                catch (dirError) {
                    console.error(`[DEBUG_DIR] Error creating directory ${options.ensureDir}:`, dirError);
                }
            }
            (0, child_process_1.exec)(command, { cwd }, (error, stdout, stderr) => __awaiter(this, void 0, void 0, function* () {
                let result = '';
                console.log('!COMMAND:', command);
                console.log('STDOUT:', stdout);
                console.log('STDERR:', stderr);
                if (error) {
                    result = `Error: ${error.message}\n\nStdout: ${stdout}\n\nStderr: ${stderr}`;
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', result);
                    return reject(new Error(result));
                }
                if (!options.skipSuccessUpdate) {
                    if (hasWarning(stdout) || (stderr && hasWarning(stderr))) {
                        result = `Warning detected:\n\nStdout: ${stdout.trim()}\n\nStderr: ${stderr.trim()}`;
                        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'warning', result);
                    }
                    else {
                        result = `Success`;
                        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', result);
                    }
                }
                resolve(stdout.trim());
            }));
        });
    });
}
;
function compileTs(tsFileName_1, compileCwd_1) {
    return __awaiter(this, arguments, void 0, function* (tsFileName, compileCwd, distFolder = "dist") {
        const taskId = (0, uuid_1.v4)();
        const compileCmd = `npx tsc ${tsFileName} --outDir ${distFolder} --module commonjs --target ES2020 --esModuleInterop`;
        const compileOutput = yield runCommand(compileCmd, compileCwd, taskId);
        console.log("Compile output:", compileOutput);
        const baseName = path_1.default.basename(tsFileName, ".ts");
        const jsFileName = baseName + ".js";
        const jsFilePath = path_1.default.join(compileCwd, distFolder, jsFileName);
        if (!fs_1.default.existsSync(jsFilePath)) {
            const msg = `Compiled file not found at: ${jsFilePath}`;
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', msg);
            throw new Error(msg);
        }
        const compiledJs = fs_1.default.readFileSync(jsFilePath, "utf8");
        console.log(`Read compiled JS from: ${jsFilePath}`);
        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `Compiled ${tsFileName} -> ${jsFileName}`);
        return compiledJs;
    });
}
const startAnchorInitTask = (projectId, rootPath, projectName, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Anchor Init', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const result = yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"`, '.', taskId);
            return result;
        }
        catch (error) {
            console.error('Error in anchor init task:', error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startAnchorInitTask = startAnchorInitTask;
const startSetClusterTask = (projectId, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Anchor Config Set Devnet', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor config set cluster devnet"`, '.', taskId);
        }
        catch (error) {
            console.error('Error setting anchor cluster:', error.message);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startSetClusterTask = startSetClusterTask;
function transformRootPath(rootPath) {
    return rootPath.replace(/-/g, '_');
}
const getBuildArtifactTask = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
        const transformedRootPath = transformRootPath(rootPath);
        const soPath = path_1.default.join(appConfig_1.APP_CONFIG.ROOT_FOLDER, rootPath, 'target', 'deploy', `${transformedRootPath}.so`);
        const fileBuffer = fs_1.default.readFileSync(soPath);
        const base64So = fileBuffer.toString('base64');
        return { status: 'success', base64So };
    }
    catch (error) {
        console.error('Error retrieving built artifact:', error);
        return { status: 'failed', base64So: '' };
    }
});
exports.getBuildArtifactTask = getBuildArtifactTask;
const startAnchorBuildTask = (projectId, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Anchor Build', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
            console.log(`Starting anchor build preparation for project ${projectId} in container ${containerName}...`);
            const scriptContent = `const fs = require('fs');
const path = require('path');

/**
 * Patches Cargo.toml with:
 *
 *   [patch.crates-io]
 *   bytemuck_derive = "=1.8.1"
 *
 * if it's not already there.
 */

// Minimal function to check if a Cargo.toml has [workspace]
function isWorkspaceToml(tomlContent) {
  return tomlContent.includes('[workspace]');
}

function patchCargoToml(cargoTomlPath) {
  // 1) Read the existing Cargo.toml
  if (!fs.existsSync(cargoTomlPath)) {
    console.error(\`Cargo.toml not found at: \${cargoTomlPath}\`);
    return false;
  }
  const originalToml = fs.readFileSync(cargoTomlPath, "utf8");

  // 2) Check if we already have the "bytemuck_derive" override
  const alreadyHasPatch = originalToml.includes("[patch.crates-io]") && 
                        originalToml.includes("bytemuck_derive =");

  // 3) If it's already pinned, do nothing
  if (alreadyHasPatch) {
    console.log(\`bytemuck_derive override already found in \${cargoTomlPath}. No change needed.\`);
    return true;
  }

  // 4) Otherwise, see if there's already a [patch.crates-io] block for us to append to
  if (originalToml.includes("[patch.crates-io]")) {
    // Insert the line under the existing [patch.crates-io] block
    const patchedToml = originalToml.replace(
      /\\[patch\\.crates-io\\]/,
      \`[patch.crates-io]\\nbytemuck_derive = "=1.8.1"\`
    );
    fs.writeFileSync(cargoTomlPath, patchedToml, "utf8");
    console.log(\`Inserted bytemuck_derive override in existing [patch.crates-io] block in \${cargoTomlPath}\`);
  } else {
    // Add a new block at the end of the file
    const appendedToml = \`\${originalToml.trim()}

[patch.crates-io]
bytemuck_derive = "=1.8.1"
\`;
    fs.writeFileSync(cargoTomlPath, appendedToml, "utf8");
    console.log(\`Added new [patch.crates-io] block with bytemuck_derive override to \${cargoTomlPath}\`);
  }
  return true;
}

// Find all Cargo.toml files in the project directory
function findCargoTomlFiles(startPath) {
  if (!fs.existsSync(startPath)) {
    console.error("Directory not found: " + startPath);
    return [];
  }

  let results = [];
  const files = fs.readdirSync(startPath);
  
  for (const file of files) {
    const filename = path.join(startPath, file);
    const stat = fs.statSync(filename);
    
    if (stat.isDirectory() && file !== 'target' && file !== 'node_modules' && !file.startsWith('.')) {
      // Skip target/ and node_modules/ directories for efficiency
      results = results.concat(findCargoTomlFiles(filename));
    } else if (file === 'Cargo.toml') {
      results.push(filename);
    }
  }
  
  return results;
}

// Main logic
const projectDir = process.argv[2];
if (!projectDir) {
  console.error("Usage: node patchCargoToml.js /path/to/project/directory");
  process.exit(1);
}

// First find the top-level Cargo.toml
const topLevelCargoToml = path.join(projectDir, 'Cargo.toml');
if (!fs.existsSync(topLevelCargoToml)) {
  console.log('No top-level Cargo.toml found; nothing to patch.');
  process.exit(0);
}

// 1) Is the top-level a workspace?
const topLevelContent = fs.readFileSync(topLevelCargoToml, 'utf8');
const hasWorkspace = isWorkspaceToml(topLevelContent);

// 2) If workspace, patch only the top-level. If not, patch them all
if (hasWorkspace) {
  console.log(\`Top-level Cargo.toml has [workspace], so only patching the root Cargo.toml.\`);
  patchCargoToml(topLevelCargoToml);
} else {
  console.log(\`No [workspace] in top-level, so patching all Cargo.toml files...\`);
  const allCargoTomlFiles = findCargoTomlFiles(projectDir);
  console.log(\`Found \${allCargoTomlFiles.length} Cargo.toml files in project\`);
  // Patch them all
  for (const cargoTomlPath of allCargoTomlFiles) {
    patchCargoToml(cargoTomlPath);
  }
}

console.log("All relevant Cargo.toml files have been patched successfully");`;
            const buildScriptContent = `#!/bin/bash
set -euo pipefail

cd /usr/src/${rootPath}

echo "===== Step 1: Removing Cargo registry cache to prevent using cached bytemuck_derive 1.9.1 ====="
rm -rf /root/.cargo/registry

echo "===== Step 2: Removing all Cargo.lock files to force fresh dependency resolution ====="
find . -name 'Cargo.lock' -type f -delete

echo "===== Step 3: Patching Cargo.toml files to force bytemuck_derive = 1.8.1 ====="
node /tmp/patchCargoToml.js /usr/src/${rootPath}

echo "===== Step 4: Explicitly pinning bytemuck_derive to version 1.8.1 ====="
cargo update -p bytemuck_derive --precise 1.8.1 || echo "Cargo update step completed (this warning is normal if bytemuck_derive hasn't been pulled yet)"

echo "===== Step 5: Generating a fresh Cargo.lock file ====="
cargo generate-lockfile

echo "===== Step 6: Forcing Cargo.lock to version 3 to fix '-Znext-lockfile-bump' error ====="
sed -i 's/^version = 4$/version = 3/' Cargo.lock
echo "Cargo.lock set to version 3"

echo "===== Step 7: Performing name check between Cargo.toml and Anchor.toml ====="
if [ -f Cargo.toml ] && [ -f Anchor.toml ]; then
  CARGO_NAME=$(grep -m 1 '^name *=' Cargo.toml | cut -d '"' -f 2)
  echo "Program name in Cargo.toml: $CARGO_NAME"
  if grep -q "$CARGO_NAME" Anchor.toml; then
    echo "✓ Program name match confirmed between Cargo.toml and Anchor.toml"
  else
    echo "WARNING: Program name in Cargo.toml may not match Anchor.toml"
  fi
else
  echo "WARNING: One or more configuration files missing"
fi

echo "===== Step 8: Running anchor build with prepared environment ====="
anchor build
`;
            const tempDir = path_1.default.join(__dirname, '../../tmp');
            if (!fs_1.default.existsSync(tempDir)) {
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            }
            const patchScriptPath = path_1.default.join(tempDir, `patch-${projectId}.js`);
            fs_1.default.writeFileSync(patchScriptPath, scriptContent, 'utf8');
            const buildScriptPath = path_1.default.join(tempDir, `build-${projectId}.sh`);
            fs_1.default.writeFileSync(buildScriptPath, buildScriptContent, 'utf8');
            console.log(`Created build scripts locally at ${tempDir}`);
            console.log(`Starting comprehensive build for project ${projectId}...`);
            try {
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'doing', 'Anchor build in progress...');
                console.log(`Copying JS patch script to container ${containerName}...`);
                yield runCommand(`docker cp ${patchScriptPath} ${containerName}:/tmp/patchCargoToml.js`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                console.log(`Copying build script to container ${containerName}...`);
                yield runCommand(`docker cp ${buildScriptPath} ${containerName}:/tmp/build.sh`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                console.log(`Making build script executable...`);
                yield runCommand(`docker exec ${containerName} chmod +x /tmp/build.sh`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                console.log(`Executing build script in container ${containerName}...`);
                const buildOutput = yield runCommand(`docker exec ${containerName} /bin/bash /tmp/build.sh`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                const transformedRootPath = rootPath.replace(/-/g, '_');
                const soFileCheck = yield runCommand(`docker exec ${containerName} /bin/bash -c "if [ -f /usr/src/${rootPath}/target/deploy/${transformedRootPath}.so ]; then echo 'BUILD_SUCCESS: .so file was created'; else echo 'BUILD_FAILURE: .so file was NOT created'; fi"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                try {
                    fs_1.default.unlinkSync(patchScriptPath);
                    fs_1.default.unlinkSync(buildScriptPath);
                }
                catch (cleanupError) {
                    console.log(`Non-critical error cleaning up temp files: ${cleanupError.message}`);
                }
                if (soFileCheck.includes('BUILD_SUCCESS')) {
                    yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Build completed successfully. .so file was created.`);
                }
                else {
                    const fullBuildError = `Build process completed but no .so file was created.\n\nBuild output: ${buildOutput}`;
                    console.error(fullBuildError);
                    yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', fullBuildError);
                }
            }
            catch (buildError) {
                console.error(`Anchor build failed with error: ${buildError.message}`);
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Anchor build failed: ${buildError.message || 'Unknown build error occurred'}`);
                try {
                    fs_1.default.unlinkSync(patchScriptPath);
                    fs_1.default.unlinkSync(buildScriptPath);
                }
                catch (cleanupError) {
                    console.log(`Non-critical error cleaning up temp files: ${cleanupError.message}`);
                }
            }
        }
        catch (error) {
            console.error(`Error in anchor build task: ${error.message}`);
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startAnchorBuildTask = startAnchorBuildTask;
const startAnchorDeployTask = (projectId, creatorId, ephemeralPubkey) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Anchor Deploy', creatorId, projectId);
    let programId = null;
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url https://api.devnet.solana.com"`, '.', sanitizedTaskId);
            let walletPath;
            if (ephemeralPubkey) {
                walletPath = path_1.default.join(appConfig_1.APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
                console.log(`Using ephemeral key for deployment: ${ephemeralPubkey}`);
                const containerWalletPath = `/tmp/${ephemeralPubkey}.json`;
                yield runCommand(`docker cp ${walletPath} ${containerName}:${containerWalletPath}`, '.', sanitizedTaskId);
                yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --keypair ${containerWalletPath}"`, '.', sanitizedTaskId);
            }
            else {
                walletPath = path_1.default.join(appConfig_1.APP_CONFIG.WALLETS_FOLDER, `${creatorId}.json`);
                console.log(`Using creator key for deployment: ${creatorId}`);
                const containerWalletPath = `/tmp/${creatorId}.json`;
                yield runCommand(`docker cp ${walletPath} ${containerName}:${containerWalletPath}`, '.', sanitizedTaskId);
                yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --keypair ${containerWalletPath}"`, '.', sanitizedTaskId);
            }
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && solana config set --url devnet"`, '.', sanitizedTaskId);
            const result = yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor deploy"`, '.', sanitizedTaskId).catch((error) => __awaiter(void 0, void 0, void 0, function* () {
                console.error('Error during deployment:', sanitizedTaskId, error);
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error: ${error.message}`);
            }));
            if (result && result.startsWith('Error:')) {
                console.error(`Deployment failed for Task ID: ${sanitizedTaskId}. Reason: ${result}`);
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', result);
                return;
            }
            const programIdMatch = result === null || result === void 0 ? void 0 : result.match(/Program Id:\s+([a-zA-Z0-9]+)/);
            if (!programIdMatch)
                throw new Error('Program ID not found in deploy output. Deployment may have failed.');
            programId = programIdMatch[1];
            if (programId)
                console.log(`Program successfully deployed with ID: ${programId}`);
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', programId);
        }
        catch (error) {
            console.error('Error during deployment:', sanitizedTaskId, error);
            return [sanitizedTaskId, null];
        }
    }));
    return sanitizedTaskId;
});
exports.startAnchorDeployTask = startAnchorDeployTask;
const startAnchorTestTask = (projectId, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Anchor Test', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor test"`, '.', taskId);
        }
        catch (error) {
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startAnchorTestTask = startAnchorTestTask;
const startCustomCommandTask = (projectId, creatorId, commandType, functionName, parameters, ephemeralPubkey) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)(commandType === 'runFunction' ? `Run Function: ${functionName}` : commandType, creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            if (commandType === 'runFunction' && functionName) {
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'doing', `Executing function ${functionName}...`);
                try {
                    const output = yield runUserProjectCode(projectId, taskId, functionName, parameters, ephemeralPubkey);
                    if (output.includes('ERROR:')) {
                        throw new Error(output.split('ERROR:')[1].trim());
                    }
                    try {
                        const parsedResult = JSON.parse(output);
                        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', JSON.stringify(parsedResult));
                    }
                    catch (parseError) {
                        const wrappedResult = { message: output };
                        yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', JSON.stringify(wrappedResult));
                    }
                }
                catch (error) {
                    console.error(`Error executing function:`, error);
                    yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error executing function: ${error.message}`);
                }
            }
            else {
                const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
                yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && ${commandType}"`, '.', taskId);
            }
        }
        catch (error) {
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startCustomCommandTask = startCustomCommandTask;
const startInstallPackagesTask = (projectId, creatorId, _packages) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Install NPM Packages', creatorId, projectId);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPath = yield (0, fileUtils_1.getProjectRootPath)(projectId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npm install @coral-xyz/anchor"`, '.', taskId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npm install @solana/web3.js"`, '.', taskId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npm install @solana/spl-token"`, '.', taskId);
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npm install fs"`, '.', taskId);
            if (_packages) {
                for (const _package of _packages) {
                    yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npm install ${_package}"`, '.', taskId);
                }
            }
        }
        catch (error) {
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startInstallPackagesTask = startInstallPackagesTask;
function hybridRootPackageJson(projectName, projectDesc = 'A React application') {
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
const startCreateProjectDirectoryTask = (creatorId_1, rootPath_1, projectId_1, ...args_1) => __awaiter(void 0, [creatorId_1, rootPath_1, projectId_1, ...args_1], void 0, function* (creatorId, rootPath, projectId, projectDesc = 'A React application') {
    if (!projectId) {
        throw new Error('Project ID is required for creating a project directory');
    }
    console.log(`[DEBUG_CONTAINER] Starting createProjectDirectoryTask for projectId=${projectId}, rootPath=${rootPath}`);
    const taskId = yield (0, taskUtils_1.createTask)('Create Project Directory', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    console.log(`[DEBUG_CONTAINER] Created task with ID: ${sanitizedTaskId} for projectId=${projectId}`);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = `userproj-${projectId}-${Date.now()}`;
            console.log(`[DEBUG_CONTAINER] Creating container ${containerName} for project ${projectId}`);
            const startContainerCmd = `docker run -d \\
          --name ${containerName} \\
          -p 3001:3000 \\
          flowcode-base:latest \\
          bash -c "cd /usr/src && tail -f /dev/null"
      `;
            console.log(`[DEBUG_CONTAINER] About to execute docker run command: ${startContainerCmd}`);
            yield runCommand(startContainerCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            console.log(`[DEBUG_CONTAINER] Docker container created: name=${containerName}, about to update DB with container_url`);
            try {
                const containerUrl = `http://localhost:3001`;
                console.log(`[DEBUG_CONTAINER] Setting containerUrl=${containerUrl} for container=${containerName}, projectId=${projectId}`);
                const updateResult = yield database_1.default.query('UPDATE solanaproject SET container_name = $1, container_url = $2 WHERE id = $3', [containerName, containerUrl, projectId]);
                console.log(`[DEBUG_CONTAINER] DB updated with container_name=${containerName}, container_url=${containerUrl} for projectId=${projectId}. Rows affected:`, updateResult.rowCount);
                const verifyResult = yield database_1.default.query('SELECT container_name, container_url FROM solanaproject WHERE id = $1', [projectId]);
                if (verifyResult.rows.length > 0) {
                    console.log(`[DEBUG_CONTAINER] Verified DB update: container_name=${verifyResult.rows[0].container_name}, container_url=${verifyResult.rows[0].container_url} for projectId=${projectId}`);
                }
                else {
                    console.log(`[DEBUG_CONTAINER] Failed to verify DB update, no rows found for projectId=${projectId}`);
                }
            }
            catch (dbError) {
                console.error('[DEBUG_CONTAINER] Error storing container info in DB:', dbError);
            }
            console.log(`[DEBUG_CONTAINER] Running anchor init ${rootPath} in container ${containerName}`);
            const anchorInitCmd = `docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"
      `;
            yield runCommand(anchorInitCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -l /usr/src/${rootPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const craCmd = `
        docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && npx create-react-app@latest app --template typescript"
      `;
            yield runCommand(craCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -l /usr/src/${rootPath}/app`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const customPkg = hybridRootPackageJson(rootPath, projectDesc);
            const packageJsonCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/app/package.json" << 'EOF'
${JSON.stringify(customPkg, null, 2)}
EOF`;
            yield runCommand(packageJsonCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/app && npm install"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const readMeCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/app/README.md" << 'EOF'
# ${rootPath}

${projectDesc}

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### \`npm start\`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### \`npm test\`

Launches the test runner in the interactive watch mode.

### \`npm run build\`

Builds the app for production to the \`build\` folder.
EOF`;
            yield runCommand(readMeCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} mkdir -p -v /usr/src/${rootPath}/server/src`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -ld /usr/src/${rootPath}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}/server || echo "Server directory not found"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const customServerPkg = {
                name: `${rootPath.toLowerCase().replace(/\s+/g, '-')}-server`,
                version: '0.1.0',
                description: 'Express server for React application',
                main: 'dist/index.js',
                scripts: {
                    "start": "node dist/index.js",
                    "dev": "nodemon --exec ts-node src/index.ts",
                    "build": "tsc"
                },
                dependencies: {
                    "express": "^4.18.2",
                    "cors": "^2.8.5",
                    "dotenv": "^16.0.3",
                    "helmet": "^6.0.1"
                },
                devDependencies: {
                    "typescript": "^4.9.5",
                    "@types/express": "^4.17.17",
                    "@types/cors": "^2.8.13",
                    "@types/node": "^18.14.0",
                    "nodemon": "^2.0.20",
                    "ts-node": "^10.9.1"
                }
            };
            const serverPackageJsonCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/server/package.json" << 'EOF'
${JSON.stringify(customServerPkg, null, 2)}
EOF`;
            yield runCommand(serverPackageJsonCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}/server || echo "Server directory not found after package.json"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} cat /usr/src/${rootPath}/server/package.json || echo "Could not read package.json"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const serverIndexCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/server/src/index.ts" << 'EOF'
${templateFiles_1.serverIndexContent}
EOF`;
            yield runCommand(serverIndexCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const serverEnvCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/server/.env" << 'EOF'
${templateFiles_1.serverEnvContent}
EOF`;
            yield runCommand(serverEnvCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}/server/src || echo "Server src directory not found"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/server && npm install"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const serverTsConfig = {
                "compilerOptions": {
                    "target": "ES2020",
                    "module": "commonjs",
                    "outDir": "dist",
                    "rootDir": "src",
                    "esModuleInterop": true,
                    "strict": true
                },
                "include": ["src/**/*"]
            };
            const serverTsConfigCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/server/tsconfig.json" << 'EOF'
${JSON.stringify(serverTsConfig, null, 2)}
EOF`;
            yield runCommand(serverTsConfigCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} ls -la /usr/src/${rootPath}/server`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker inspect ${containerName} | grep -A 20 "Mounts"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const appGitignoreCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/app/.gitignore" << 'EOF'
${templateFiles_1.serverGitignoreContent}
EOF`;
            yield runCommand(appGitignoreCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const serverGitignoreCmd = `
        docker exec -i ${containerName} bash -c "cat > /usr/src/${rootPath}/server/.gitignore" << 'EOF'
${templateFiles_1.serverGitignoreContent}
EOF`;
            yield runCommand(serverGitignoreCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            /*
            await runCommand(`
              docker exec ${containerName} bash -c "
                cd /usr/src/${rootPath} &&
                git init &&
                git add . &&
                git commit -m 'Initial scaffold'
              "
            `, '.', sanitizedTaskId);
            */
            console.log("Attempting git initialization to verify filesystem...");
            yield runCommand(`
        docker exec ${containerName} bash -c "
          cd /usr/src/${rootPath} &&
          echo 'Initializing git repository...' &&
          git init &&
          echo 'Checking git status...' &&
          git status &&
          echo 'Showing directory listing after git init...' &&
          ls -la &&
          echo 'Git initialization tests complete.'
        "
      `, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker inspect --format='{{.Config.Image}}' ${containerName} && docker history $(docker inspect --format='{{.Config.Image}}' ${containerName})`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            console.log(`[DEBUG_CONTAINER] Final verification of directory structure for container ${containerName}...`);
            const finalVerification = yield runCommand(`docker exec ${containerName} bash -c "
          echo 'Full directory listing of /usr/src:' &&
          ls -la /usr/src &&
          echo '' &&
          echo 'Full directory listing of /usr/src/${rootPath}:' &&
          ls -la /usr/src/${rootPath} &&
          echo '' &&
          echo 'Server directory exists?' &&
          [ -d /usr/src/${rootPath}/server ] && echo 'YES' || echo 'NO' &&
          echo '' &&
          echo 'App directory exists?' &&
          [ -d /usr/src/${rootPath}/app ] && echo 'YES' || echo 'NO'
        "
      `, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            if (finalVerification.includes('Server directory exists?\nNO')) {
                console.warn(`[DEBUG_CONTAINER] WARNING: Server directory does not exist in container ${containerName} despite all commands succeeding`);
                yield runCommand(`docker exec ${containerName} bash -c "
            echo 'Attempting to recreate server directory...' &&
            mkdir -p -v /usr/src/${rootPath}/server/src &&
            echo 'Directory created, checking again:' &&
            ls -la /usr/src/${rootPath} &&
            [ -d /usr/src/${rootPath}/server ] && echo 'NOW EXISTS' || echo 'STILL MISSING'
          "
        `, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            }
            const runNpmStartCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/app && export CI=true && export BROWSER=none && export HOST=0.0.0.0 && export PORT=3000 && npm start > /usr/src/${rootPath}/app/cra-startup.log 2>&1 &"
      `;
            yield runCommand(runNpmStartCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            console.log(`[DEBUG_CONTAINER] CRA dev server is now starting with forced environment variables...`);
            yield runCommand(`sleep 3`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            yield runCommand(`docker exec ${containerName} bash -c "ps aux | grep 'react-scripts start' | grep -v grep || echo 'CRA process not found!'"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            console.log(`[DEBUG_CONTAINER] Checking CRA startup logs...`);
            yield runCommand(`docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/app/cra-startup.log || echo 'No startup log found'"`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
            const isServerReady = yield waitForServerReady(containerName);
            console.log(`[DEBUG_CONTAINER] Server ready check result: ${isServerReady ? 'READY' : 'NOT READY'}`);
            if (isServerReady) {
                console.log(`[DEBUG_CONTAINER] About to mark task as success. taskId=${sanitizedTaskId}, containerName=${containerName}, projectId=${projectId}`);
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Project created successfully! Anchor project in /usr/src/${rootPath}, CRA in /usr/src/${rootPath}/app, Express in /usr/src/${rootPath}/server, container: ${containerName}`);
                console.log(`[DEBUG_CONTAINER] Task marked as succeed. taskId=${sanitizedTaskId}`);
                try {
                    const finalCheckResult = yield database_1.default.query('SELECT container_url FROM solanaproject WHERE id = $1', [projectId]);
                    if (finalCheckResult.rows.length > 0) {
                        console.log(`[DEBUG_CONTAINER] Final DB check: container_url=${finalCheckResult.rows[0].container_url} for projectId=${projectId}`);
                    }
                    else {
                        console.log(`[DEBUG_CONTAINER] Final DB check: no rows found for projectId=${projectId}`);
                    }
                }
                catch (finalDbError) {
                    console.error('[DEBUG_CONTAINER] Error checking DB in final verification:', finalDbError);
                }
            }
            else {
                console.log(`[DEBUG_CONTAINER] About to mark task as success despite server not ready. taskId=${sanitizedTaskId}`);
                yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Project created! Container: ${containerName}. Anchor project in /usr/src/${rootPath}. Note: CRA dev server is still starting up and may need a few more moments.`);
                console.log(`[DEBUG_CONTAINER] Task marked as succeed. taskId=${sanitizedTaskId}`);
            }
        }
        catch (error) {
            console.error('[DEBUG_CONTAINER] Error creating project:', error);
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error creating project directory: ${error.message}`);
            console.log(`[DEBUG_CONTAINER] Task marked as failed. taskId=${sanitizedTaskId}`);
        }
    }));
    return sanitizedTaskId;
});
exports.startCreateProjectDirectoryTask = startCreateProjectDirectoryTask;
const closeProjectContainer = (projectId_1, creatorId_1, ...args_1) => __awaiter(void 0, [projectId_1, creatorId_1, ...args_1], void 0, function* (projectId, creatorId, commitBeforeClose = false, removeContainer = false) {
    const taskId = yield (0, taskUtils_1.createTask)('Close Project Container', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            console.log(`Closing container ${containerName} for project ${projectId}`);
            if (commitBeforeClose) {
                try {
                    const checkGitCmd = `docker exec ${containerName} bash -c "if [ -d /usr/src/.git ]; then echo 'git-exists'; else echo 'no-git'; fi"`;
                    const gitExists = yield runCommand(checkGitCmd, '.', sanitizedTaskId);
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
                        yield runCommand(commitCmd, '.', sanitizedTaskId);
                    }
                    else {
                        console.log(`No Git repository found in container ${containerName}, skipping commit`);
                    }
                }
                catch (gitError) {
                    console.error(`Error during Git operations:`, gitError);
                }
            }
            if (removeContainer) {
                yield runCommand(`docker rm -f ${containerName}`, '.', sanitizedTaskId);
                console.log(`Container ${containerName} forcibly stopped and removed`);
                yield database_1.default.query('UPDATE solanaproject SET container_name = NULL WHERE id = $1', [projectId]);
            }
            else {
                yield runCommand(`docker stop ${containerName}`, '.', sanitizedTaskId);
                console.log(`Container ${containerName} stopped successfully`);
            }
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Container ${containerName} for project ${projectId} ${removeContainer ? 'stopped and removed' : 'stopped'} successfully`);
        }
        catch (error) {
            console.error(`Error closing project container:`, error);
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error closing project container: ${error.message}`);
        }
    }));
    return sanitizedTaskId;
});
exports.closeProjectContainer = closeProjectContainer;
const startProjectContainer = (projectId, creatorId, rootPath) => __awaiter(void 0, void 0, void 0, function* () {
    const taskId = yield (0, taskUtils_1.createTask)('Start Project Container', creatorId, projectId);
    const sanitizedTaskId = taskId.trim().replace(/,$/, '');
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const existingContainer = yield getContainerName(projectId);
            if (existingContainer) {
                console.log(`Found existing container ${existingContainer} for project ${projectId}`);
                const checkContainerCmd = `docker ps -a --filter "name=${existingContainer}" --format "{{.Status}}"`;
                const containerStatus = yield runCommand(checkContainerCmd, '.', sanitizedTaskId);
                if (containerStatus.toLowerCase().includes('exited')) {
                    console.log(`Starting existing container ${existingContainer}...`);
                    yield runCommand(`docker start ${existingContainer}`, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                    console.log(`Restarting CRA dev server in container ${existingContainer}...`);
                    const runNpmStartCmd = `
            docker exec ${existingContainer} bash -c "cd /usr/src/app && export CI=true && export BROWSER=none && export HOST=0.0.0.0 && export PORT=3000 && npm start > /usr/src/app/cra-startup.log 2>&1 &"
          `;
                    yield runCommand(runNpmStartCmd, '.', sanitizedTaskId, { skipSuccessUpdate: true });
                    const isServerReady = yield waitForServerReady(existingContainer);
                    if (isServerReady) {
                        yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Existing container ${existingContainer} started successfully and CRA server is ready`);
                    }
                    else {
                        yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Existing container ${existingContainer} started successfully. CRA server is still starting up.`);
                    }
                }
                else if (containerStatus.toLowerCase().includes('up')) {
                    console.log(`Container ${existingContainer} is already running`);
                    yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'succeed', `Container ${existingContainer} is already running`);
                }
                else {
                    if (!rootPath) {
                        yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Container ${existingContainer} not found and rootPath not provided to create a new one`);
                        return;
                    }
                    const newContainerName = `userproj-${projectId}-${Date.now()}`;
                    console.log(`Creating new container ${newContainerName} for project ${projectId}`);
                    yield createNewContainer(newContainerName, projectId, sanitizedTaskId);
                }
            }
            else {
                if (!rootPath) {
                    yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `No container found for project ${projectId} and rootPath not provided to create a new one`);
                    return;
                }
                const newContainerName = `userproj-${projectId}-${Date.now()}`;
                console.log(`No existing container found. Creating new container ${newContainerName} for project ${projectId}`);
                yield createNewContainer(newContainerName, projectId, sanitizedTaskId);
            }
        }
        catch (error) {
            console.error(`Error starting project container:`, error);
            yield (0, taskUtils_1.updateTaskStatus)(sanitizedTaskId, 'failed', `Error starting project container: ${error.message}`);
        }
    }));
    return sanitizedTaskId;
});
exports.startProjectContainer = startProjectContainer;
function createNewContainer(containerName, projectId, taskId) {
    return __awaiter(this, void 0, void 0, function* () {
        const startContainerCmd = `
    docker run -d \\
      --name ${containerName} \\
      -p 3001:3000 \\
      flowcode-base:latest \\
      bash -c "cd /usr/src && tail -f /dev/null"
  `;
        yield runCommand(startContainerCmd, '.', taskId, { skipSuccessUpdate: true });
        const containerUrl = `http://localhost:3001`;
        yield database_1.default.query('UPDATE solanaproject SET container_name = $1, container_url = $2 WHERE id = $3', [containerName, containerUrl, projectId]);
        const rootPathResult = yield database_1.default.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
        let rootPath = '';
        if (rootPathResult.rows.length > 0) {
            rootPath = (0, stringUtils_1.normalizeProjectName)(rootPathResult.rows[0].name);
        }
        else {
            rootPath = `project-${projectId}`;
        }
        const anchorInitCmd = `
    docker exec ${containerName} bash -c "cd /usr/src && anchor init ${rootPath}"
  `;
        yield runCommand(anchorInitCmd, '.', taskId, { skipSuccessUpdate: true });
        const runNpmStartCmd = `
    docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/app && export CI=true && export BROWSER=none && export HOST=0.0.0.0 && export PORT=3000 && npm start > /usr/src/${rootPath}/app/cra-startup.log 2>&1 &"
  `;
        yield runCommand(runNpmStartCmd, '.', taskId, { skipSuccessUpdate: true });
        console.log(`CRA dev server starting in container ${containerName} with forced environment variables`);
        const isServerReady = yield waitForServerReady(containerName);
        if (isServerReady) {
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `New container ${containerName} created successfully and CRA server is ready`);
        }
        else {
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `New container ${containerName} created successfully. CRA server is still starting up.`);
        }
    });
}
const startInstallNodeDependenciesTask = (projectId_1, creatorId_1, packages_1, ...args_1) => __awaiter(void 0, [projectId_1, creatorId_1, packages_1, ...args_1], void 0, function* (projectId, creatorId, packages, targetDir = 'app') {
    const taskId = yield (0, taskUtils_1.createTask)('Install Node Dependencies', creatorId, projectId);
    console.log(`Starting node dependency installation task for project ${projectId} with packages:`, packages);
    setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (packages.length === 0) {
                console.log(`No packages to install for project ${projectId}`);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', 'No packages to install');
                return;
            }
            const containerName = yield getContainerName(projectId);
            if (!containerName) {
                throw new Error(`No container found for project ${projectId}`);
            }
            const rootPathResult = yield database_1.default.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
            let rootPath = '';
            if (rootPathResult.rows.length > 0) {
                rootPath = (0, stringUtils_1.normalizeProjectName)(rootPathResult.rows[0].name);
            }
            else {
                throw new Error(`Could not determine project name for project ${projectId}`);
            }
            console.log(`Found container ${containerName} for project ${projectId}`);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'doing', `Installing ${packages.join(', ')} in ${targetDir}...`);
            console.log(`Installing packages: ${packages.join(', ')} for project ${projectId} in ${targetDir}`);
            const installCommand = `npm install ${packages.join(' ')}`;
            console.log(`Install command: ${installCommand}`);
            try {
                const dockerInstallCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/${targetDir} && ${installCommand}"`;
                console.log(`Executing in container: ${dockerInstallCmd}`);
                yield runCommand(dockerInstallCmd, '.', taskId);
                console.log(`Successfully installed packages in container ${containerName} (${targetDir})`);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'succeed', `Successfully installed dependencies in container ${containerName} (${targetDir})`);
            }
            catch (error) {
                console.error(`Failed to install packages in container. Error:`, error);
                yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error installing dependencies: ${error.message}`);
            }
        }
        catch (error) {
            console.error(`Error in startInstallNodeDependenciesTask:`, error);
            yield (0, taskUtils_1.updateTaskStatus)(taskId, 'failed', `Error: ${error.message}`);
        }
    }));
    return taskId;
});
exports.startInstallNodeDependenciesTask = startInstallNodeDependenciesTask;
function runUserProjectCode(projectId, taskId, functionName, parameters, ephemeralPubkey) {
    return __awaiter(this, void 0, void 0, function* () {
        const containerName = yield getContainerName(projectId);
        if (!containerName) {
            throw new Error(`No container found for project ${projectId}`);
        }
        const rootPathResult = yield database_1.default.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
        let rootPath = '';
        if (rootPathResult.rows.length > 0) {
            rootPath = (0, stringUtils_1.normalizeProjectName)(rootPathResult.rows[0].name);
        }
        else {
            throw new Error(`Could not determine project name for project ${projectId}`);
        }
        console.log(`Found container ${containerName} for project ${projectId}`);
        const tempRunnerDir = `/usr/src/${rootPath}/app/_temp_${taskId}`;
        yield runCommand(`docker exec ${containerName} mkdir -p ${tempRunnerDir}`, '.', taskId);
        const runnerSrcPath = path_1.default.join(__dirname, '../../runners/myRunnerTemplate.ts');
        const ephemeralSrcPath = path_1.default.join(__dirname, '../../runners/ephemeralKeyUtils.ts');
        const localBundlrSrcPath = path_1.default.join(__dirname, '../../runners/localBundlrUtils.ts');
        yield runCommand(`docker cp ${runnerSrcPath} ${containerName}:${tempRunnerDir}/runner.ts`, '.', taskId);
        yield runCommand(`docker cp ${ephemeralSrcPath} ${containerName}:${tempRunnerDir}/ephemeralKeyUtils.ts`, '.', taskId);
        yield runCommand(`docker cp ${localBundlrSrcPath} ${containerName}:${tempRunnerDir}/localBundlrUtils.ts`, '.', taskId);
        let finalParams;
        if (Array.isArray(parameters)) {
            finalParams = ephemeralPubkey ? [...parameters, ephemeralPubkey] : parameters;
        }
        else {
            finalParams = ephemeralPubkey ? Object.assign(Object.assign({}, parameters), { ephemeralPubkey }) : parameters;
        }
        const paramsContent = JSON.stringify(finalParams, null, 2);
        const writeParamsCmd = `docker exec -i ${containerName} bash -c "cat > ${tempRunnerDir}/params.json" << 'EOF'
${paramsContent}
EOF`;
        yield runCommand(writeParamsCmd, '.', taskId);
        const compileCommand = [
            'npx ts-node',
            '--skip-project',
            '--transpile-only',
            `--compiler-options '{"module":"commonjs","esModuleInterop":true}'`,
            `"${tempRunnerDir}/runner.ts"`,
            `"${tempRunnerDir}/params.json"`
        ].join(' ');
        const dockerRunCmd = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath}/app && ${compileCommand}"`;
        const commandResult = yield runCommand(dockerRunCmd, '.', taskId);
        yield runCommand(`docker exec ${containerName} rm -rf ${tempRunnerDir}`, '.', taskId);
        return commandResult;
    });
}
function updateContainerInDB(containerName, projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield database_1.default.query('UPDATE solanaproject SET container_name = $1 WHERE id = $2', [containerName, projectId]);
    });
}
function getContainerName(projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield database_1.default.query('SELECT container_name FROM solanaproject WHERE id = $1', [projectId]);
        if (!result.rows.length || !result.rows[0].container_name) {
            return null;
        }
        return result.rows[0].container_name;
    });
}
function waitForServerReady(containerName_1) {
    return __awaiter(this, arguments, void 0, function* (containerName, maxAttempts = 30, delayMs = 1000) {
        console.log(`Waiting for CRA server to be ready in container ${containerName}...`);
        const projectIdResult = yield database_1.default.query('SELECT id FROM solanaproject WHERE container_name = $1', [containerName]);
        if (!projectIdResult.rows.length) {
            console.log(`Could not find project ID for container ${containerName}`);
            return false;
        }
        const projectId = projectIdResult.rows[0].id;
        const rootPathResult = yield database_1.default.query('SELECT name FROM solanaproject WHERE id = $1', [projectId]);
        let rootPath = '';
        if (rootPathResult.rows.length > 0) {
            rootPath = (0, stringUtils_1.normalizeProjectName)(rootPathResult.rows[0].name);
        }
        else {
            console.log(`Could not determine project name for project ${projectId}`);
            return false;
        }
        try {
            const processCheck = yield new Promise((resolve) => {
                (0, child_process_1.exec)(`docker exec ${containerName} bash -c "ps aux | grep 'react-scripts start' | grep -v grep"`, (error, stdout) => {
                    resolve(stdout.trim());
                });
            });
            console.log(`CRA process check: ${processCheck ? "Process found" : "No process found"}`);
            if (!processCheck) {
                console.log("CRA dev server process is not running - checking logs for errors:");
                yield new Promise((resolve) => {
                    (0, child_process_1.exec)(`docker exec ${containerName} bash -c "cat /usr/src/${rootPath}/app/cra-startup.log || echo 'No log file'"`, (error, stdout) => {
                        console.log("CRA startup log contents:", stdout);
                        resolve();
                    });
                });
            }
        }
        catch (error) {
            console.log("Error checking for CRA process:", error);
        }
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const checkCmd = `docker exec ${containerName} bash -c "curl -s http://localhost:3000 -o /dev/null -w '%{http_code}' || curl -s http://0.0.0.0:3000 -o /dev/null -w '%{http_code}'"`;
                const result = yield new Promise((resolve, reject) => {
                    (0, child_process_1.exec)(checkCmd, (error, stdout, stderr) => {
                        if (error && !stdout.includes('200')) {
                            reject(error);
                        }
                        else {
                            resolve(stdout.trim());
                        }
                    });
                });
                if (result === '200') {
                    console.log(`CRA server is ready in container ${containerName} after ${attempt} attempts`);
                    return true;
                }
                console.log(`Attempt ${attempt}/${maxAttempts}: Server not ready yet, status code: ${result}`);
            }
            catch (error) {
                console.log(`Attempt ${attempt}/${maxAttempts}: Server not responding yet`);
            }
            yield new Promise(resolve => setTimeout(resolve, delayMs));
        }
        console.log(`Server did not become ready after ${maxAttempts} attempts`);
        return false;
    });
}
