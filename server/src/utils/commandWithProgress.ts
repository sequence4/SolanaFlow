import { spawn } from 'child_process';

interface ProgressState {
  lastUpdate: number;
  estimatedTotal: number;
  currentStep: number;
  lastProgress: number;
}

export function runCommandWithProgress(
  command: string,
  _projectId: string,
  onProgress: (output: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let outputBuffer = '';
    
    process.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      output.split('\n').forEach((line: string) => {
        if (line.trim()) {
          onProgress(line);
        }
      });
    });
    
    process.stderr.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
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

// Enhanced version with smart progress tracking
export function runCommandWithSmartProgress(
  command: string,
  projectId: string,
  onProgress: (output: string, parsed?: { current?: number, total?: number, step?: string }) => void
): Promise<void> {
  const state: ProgressState = {
    lastUpdate: Date.now(),
    estimatedTotal: 100,
    currentStep: 0,
    lastProgress: 30 // Start at 30% since that's where we enter build
  };
  
  // Track compilation steps for better progress estimation
  const compilationSteps = new Set<string>();
  let isCompiling = false;
  let lastActivityTime = Date.now();
  
  // Send periodic progress updates during silent compilation
  const progressInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
    // If we're compiling and haven't seen output for a bit, send estimated progress
    if (isCompiling && timeSinceLastActivity < 10000) { // Only if activity within last 10s
      const timeSinceStart = now - state.lastUpdate;
      const estimatedProgress = Math.min(
        90, // Cap at 90% until we see completion
        state.lastProgress + (timeSinceStart / 180000) * 50 // Assume 3 min build, progress 50%
      );
      
      if (estimatedProgress > state.lastProgress + 1) { // Only update if meaningful change
        state.lastProgress = estimatedProgress;
        onProgress('', {
          current: Math.round(estimatedProgress),
          total: 100,
          step: `Building program... (${Math.round(estimatedProgress)}%)`
        });
      }
    }
  }, 2000); // Update every 2 seconds
  
  const promise = runCommandWithProgress(command, projectId, (output) => {
    lastActivityTime = Date.now();
    let parsed: { current?: number, total?: number, step?: string } | undefined;
    
    // Detect compilation start
    if (output.includes('anchor build') || output.includes('cargo build-sbf')) {
      isCompiling = true;
      state.lastUpdate = Date.now();
      parsed = {
        current: 35,
        total: 100,
        step: 'Starting Rust compilation...'
      };
      state.lastProgress = 35;
    }
    
    // Parse yarn/npm install progress
    else if (output.includes('yarn install') || output.includes('npm install')) {
      const yarnMatch = output.match(/\[(\d+)\/(\d+)\]/);
      if (yarnMatch) {
        parsed = {
          current: parseInt(yarnMatch[1]),
          total: parseInt(yarnMatch[2]),
          step: 'Installing dependencies'
        };
      }
    }
    
    // Parse cargo/rust compilation progress
    else if (output.includes('Compiling')) {
      const cargoMatch = output.match(/Compiling\s+(\S+)\s+v?([\d.]+)?/);
      if (cargoMatch) {
        compilationSteps.add(cargoMatch[1]);
        // Estimate progress based on number of crates compiled
        const estimatedProgress = Math.min(
          85,
          35 + (compilationSteps.size * 2) // Each crate adds ~2% progress
        );
        parsed = {
          current: estimatedProgress,
          total: 100,
          step: `Compiling ${cargoMatch[1]}${cargoMatch[2] ? ` v${cargoMatch[2]}` : ''}`
        };
        state.lastProgress = estimatedProgress;
      }
    }
    
    // Detect various build stages
    else if (output.includes('Downloaded') || output.includes('Downloading')) {
      parsed = {
        current: 40,
        total: 100,
        step: 'Downloading dependencies...'
      };
      state.lastProgress = 40;
    }
    else if (output.includes('Building') && output.includes('[')) {
      // Try to parse cargo progress bar: Building [====>    ]
      const progressMatch = output.match(/Building\s*\[([=>\s-]+)\]/);
      if (progressMatch) {
        const bar = progressMatch[1];
        const completed = (bar.match(/=/g) || []).length;
        const total = bar.length;
        const percentage = 45 + Math.round((completed / total) * 40); // 45-85% range
        parsed = {
          current: percentage,
          total: 100,
          step: 'Building BPF bytecode...'
        };
        state.lastProgress = percentage;
      }
    }
    else if (output.includes('Finished release')) {
      parsed = {
        current: 90,
        total: 100,
        step: 'Finalizing build artifacts...'
      };
      state.lastProgress = 90;
      isCompiling = false;
    }
    else if (output.includes('BUILD_SUCCESS') || output.includes('deployed program')) {
      parsed = {
        current: 95,
        total: 100,
        step: 'Build completed successfully!'
      };
      state.lastProgress = 95;
      isCompiling = false;
    }
    
    // Check for specific anchor build stages
    else if (output.includes('cargo-build-sbf')) {
      parsed = {
        current: 45,
        total: 100,
        step: 'Invoking Solana BPF builder...'
      };
      state.lastProgress = 45;
    }
    else if (output.includes('Creating BPF')) {
      parsed = {
        current: 80,
        total: 100,
        step: 'Creating BPF program binary...'
      };
      state.lastProgress = 80;
    }
    
    // Send the update
    onProgress(output, parsed);
  });
  
  // Clean up interval when done
  return promise.finally(() => {
    clearInterval(progressInterval);
  });
}

// Specialized function for anchor build with better progress tracking
export async function runAnchorBuildWithProgress(
  containerName: string,
  rootPath: string,
  programName: string,
  projectId: string,
  onProgress: (message: string, percentage: number) => void
): Promise<string> {
  const buildStages = [
    { pattern: /anchor build/, percentage: 35, message: 'Starting anchor build...' },
    { pattern: /Downloading|Downloaded/, percentage: 40, message: 'Downloading dependencies...' },
    { pattern: /Compiling.*proc-macro/, percentage: 45, message: 'Compiling procedural macros...' },
    { pattern: /Compiling anchor-lang/, percentage: 50, message: 'Compiling Anchor framework...' },
    { pattern: /Compiling.*solana/, percentage: 55, message: 'Compiling Solana libraries...' },
    { pattern: /Compiling.*spl/, percentage: 60, message: 'Compiling SPL libraries...' },
    { pattern: /Compiling.*borsh/, percentage: 65, message: 'Compiling serialization...' },
    { pattern: /Compiling.*serde/, percentage: 70, message: 'Compiling serde...' },
    { pattern: new RegExp(`Compiling.*${programName}`), percentage: 75, message: `Compiling ${programName}...` },
    { pattern: /cargo-build-sbf/, percentage: 80, message: 'Building BPF bytecode...' },
    { pattern: /Creating BPF/, percentage: 85, message: 'Creating program binary...' },
    { pattern: /Finished release/, percentage: 90, message: 'Finalizing artifacts...' },
    { pattern: /BUILD_SUCCESS/, percentage: 95, message: 'Build completed!' }
  ];
  
  let currentStage = 30;
  let lastUpdateTime = Date.now();
  
  // Start a timer for estimated progress
  const estimatedProgressTimer = setInterval(() => {
    const elapsed = Date.now() - lastUpdateTime;
    if (elapsed > 5000 && currentStage < 85) { // No update for 5s
      currentStage = Math.min(currentStage + 2, 85);
      onProgress(`Building... (estimated ${currentStage}%)`, currentStage);
    }
  }, 5000);
  
  const command = `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && anchor build -p ${programName} 2>&1"`;
  
  try {
    await runCommandWithProgress(command, projectId, (output) => {
      lastUpdateTime = Date.now();
      
      // Check each stage pattern
      for (const stage of buildStages) {
        if (stage.pattern.test(output) && stage.percentage > currentStage) {
          currentStage = stage.percentage;
          onProgress(stage.message, currentStage);
          break;
        }
      }
      
      // Also send raw output for detailed logging
      if (output.includes('Compiling') || output.includes('Building')) {
        const match = output.match(/Compiling\s+(\S+)/);
        if (match && currentStage < 75) {
          currentStage = Math.min(currentStage + 1, 75);
          onProgress(`Compiling ${match[1]}...`, currentStage);
        }
      }
    });
    
    clearInterval(estimatedProgressTimer);
    onProgress('Build completed successfully!', 100);
    return 'success';
  } catch (error) {
    clearInterval(estimatedProgressTimer);
    throw error;
  }
}