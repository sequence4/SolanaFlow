import { getContainerName } from "../container/getContainerName";
import pool from "../../config/database";
import { normalizeProjectName } from "../stringUtils";
import { runCommand } from "../command-execution/runCommand";
import path from 'path';

export async function runUserProjectCode(
    projectId: string,
    taskId: string,
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