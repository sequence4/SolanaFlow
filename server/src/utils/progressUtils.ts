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
 */
export const sendCodeGenProgress = (sendProgress: (data: any) => void): Promise<void> => {
  return new Promise((resolve) => {
    let currentPct = 0; // START AT 0, not 10
    const targetPct = 100;
    
    // Smooth increments over time
    const interval = setInterval(() => {
      // Small random increments (2-5%)
      const increment = Math.floor(Math.random() * 4) + 2;
      currentPct = Math.min(currentPct + increment, targetPct);
      
      sendProgress({
        stage: 'code-gen',
        status: 'active',
        message: `Generating Solana program files... ${currentPct}%`,
        pct: currentPct
      });
      
      if (currentPct >= targetPct) {
        clearInterval(interval);
        resolve();
      }
    }, 300); // Update every 300ms for smooth progress
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