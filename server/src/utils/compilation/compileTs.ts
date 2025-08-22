import { updateTaskStatus } from "../taskUtils";
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { runCommand } from "../command-execution/runCommand";

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