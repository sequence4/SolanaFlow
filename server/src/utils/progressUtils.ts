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
 * Send progress updates for code generation - starts at 0%
 */
export const sendCodeGenProgress = async (
  sendProgress: (data: any) => void,
  totalFiles: number = 5
): Promise<void> => {
  // Start at 0% explicitly
  sendProgress({
    stage: 'code-gen',
    status: 'active',
    message: 'Starting code generation...',
    pct: 0
  });
  
  await new Promise(resolve => setTimeout(resolve, 200)); // Small delay to show 0%
  
  const pctPerFile = 80 / totalFiles; // Leave 20% for final steps
  
  for (let i = 0; i < totalFiles; i++) {
    const targetPct = Math.round((i + 1) * pctPerFile);
    await sendSmoothProgress(
      sendProgress,
      'code-gen',
      targetPct,
      `Generating file ${i + 1}/${totalFiles}...`,
      300 // Slower updates for visibility
    );
  }
  
  // Final steps
  await sendSmoothProgress(
    sendProgress,
    'code-gen',
    95,
    'Finalizing code generation...',
    200
  );
  
  await sendSmoothProgress(
    sendProgress,
    'code-gen',
    100,
    'Code generation complete!',
    200
  );
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