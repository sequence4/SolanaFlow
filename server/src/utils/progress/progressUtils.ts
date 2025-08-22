// Track progress per stage to prevent going backwards
let currentProgress: { [key: string]: number } = {};

/**
 * Clear progress when starting new build
 */
export const resetProgress = () => {
  currentProgress = {};
};

/**
 * Helper function for sending smooth percentage updates
 * Simulates realistic progress with random increments
 * CRITICAL: Never allows progress to go backwards
 */
export const sendSmoothProgress = (
  sendProgress: (data: any) => void,
  stage: string,
  targetPct: number,
  message: string,
  delayBetweenUpdatesMs: number = 150
): Promise<void> => {
  return new Promise((resolve) => {
    // Get the last known progress for this stage
    const startPct = currentProgress[stage] || 0;
    
    // CRITICAL: Never go backwards
    if (targetPct <= startPct) {
      sendProgress({
        stage,
        status: 'active',
        message,
        pct: startPct // Keep current value
      });
      resolve();
      return;
    }
    
    let currentPct = startPct;
    const totalIncrease = targetPct - startPct;
    const increments = [2, 3, 5, 4, 6, 3, 7, 4, 5, 8, 3, 6, 4]; // Random realistic increments
    let incrementIndex = 0;
    
    const updateProgress = () => {
      if (currentPct >= targetPct) {
        // Store the final progress
        currentProgress[stage] = targetPct;
        // Send final update to ensure we hit the target
        sendProgress({
          stage,
          status: 'active',
          message,
          pct: targetPct
        });
        resolve();
        return;
      }
      
      // Random increment between 2-8%, but ensure we don't overshoot
      const remainingPct = targetPct - currentPct;
      const increment = Math.min(
        increments[incrementIndex % increments.length],
        remainingPct
      );
      
      currentPct += increment;
      
      // Store the current progress
      currentProgress[stage] = currentPct;
      
      sendProgress({
        stage,
        status: 'active',
        message,
        pct: currentPct
      });
      
      incrementIndex++;
      setTimeout(updateProgress, delayBetweenUpdatesMs);
    };
    
    updateProgress();
  });
};

/**
 * Send progress updates with realistic intervals for environment setup
 */
export const sendEnvironmentProgress = async (
  sendProgress: (data: any) => void
): Promise<void> => {
  await sendSmoothProgress(
    sendProgress,
    'environment',
    30,
    'Initializing environment...',
    200
  );
  
  await sendSmoothProgress(
    sendProgress,
    'environment',
    65,
    'Setting up container...',
    150
  );
  
  await sendSmoothProgress(
    sendProgress,
    'environment',
    90,
    'Preparing workspace...',
    120
  );
  
  await sendSmoothProgress(
    sendProgress,
    'environment',
    100,
    'Environment ready!',
    100
  );
};

/**
 * Send progress updates for code generation - starts at 0% with smooth increments
 * Note: This function is designed to work with the global file collection system in handleGenerateCode.ts
 * The actual progress is now controlled by file generation events rather than time-based increments
 */
export const sendCodeGenProgress = (sendProgress: (data: any) => void): Promise<void> => {
  return new Promise((resolve) => {
    console.log('[PROGRESS] Starting code generation progress at 0%');
    
    // Simply send the initial 0% progress and resolve immediately
    // The actual progress updates are now handled by the file generation process
    sendProgress({
      stage: 'code-gen',
      status: 'active',
      message: '🦀 Starting Solana program generation...',
      pct: 0
    });
    
    console.log('[PROGRESS] Initial progress sent, file-based progress will take over');
    resolve();
  });
};

/**
 * Send progress updates for build process
 */
export const sendBuildProgress = async (
  sendProgress: (data: any) => void
): Promise<void> => {
  await sendSmoothProgress(
    sendProgress,
    'build',
    25,
    'Compiling Rust code...',
    200
  );
  
  await sendSmoothProgress(
    sendProgress,
    'build',
    50,
    'Linking dependencies...',
    180
  );
  
  await sendSmoothProgress(
    sendProgress,
    'build',
    75,
    'Optimizing build...',
    150
  );
  
  await sendSmoothProgress(
    sendProgress,
    'build',
    95,
    'Creating artifacts...',
    120
  );
  
  await sendSmoothProgress(
    sendProgress,
    'build',
    100,
    'Build complete!',
    100
  );
};