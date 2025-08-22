import { spawn } from 'child_process';

export function runCommandWithProgress(
  command: string,
  _projectId: string, // Mark as intentionally unused
  onProgress: (output: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let outputBuffer = '';
    
    process.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // Send progress updates for each line
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          onProgress(line);
        }
      });
    });
    
    process.stderr.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      // Some tools output progress to stderr
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          onProgress(line);
        }
      });
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}: ${outputBuffer}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Enhanced version that also parses common tool outputs
export function runCommandWithSmartProgress(
  command: string,
  projectId: string,
  onProgress: (output: string, parsed?: { current?: number, total?: number, step?: string }) => void
): Promise<void> {
  return runCommandWithProgress(command, projectId, (output) => {
    let parsed: { current?: number, total?: number, step?: string } | undefined;
    
    // Parse yarn/npm install progress
    const yarnMatch = output.match(/(\d+)\/(\d+)/);
    if (yarnMatch) {
      parsed = {
        current: parseInt(yarnMatch[1]),
        total: parseInt(yarnMatch[2]),
        step: 'Installing packages'
      };
    }
    
    // Parse cargo build progress
    const cargoMatch = output.match(/Compiling (\S+)/);
    if (cargoMatch) {
      parsed = {
        step: `Compiling ${cargoMatch[1]}`
      };
    }
    
    // Parse anchor build progress with progress bar
    const anchorBuildMatch = output.match(/Building \[([=>\s]+)\]/);
    if (anchorBuildMatch) {
      const progressBar = anchorBuildMatch[1];
      const completed = (progressBar.match(/=/g) || []).length;
      const total = progressBar.length;
      parsed = {
        current: completed,
        total: total,
        step: 'Building program'
      };
    }
    
    onProgress(output, parsed);
  });
}