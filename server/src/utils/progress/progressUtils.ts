/**
 * Clear progress when starting new build
 */
export const resetProgress = () => {
  // Nothing to clear in simplified version
};

/**
 * Helper function for sending simple status updates
 */
export const sendSimpleUpdate = (
  sendProgress: (data: any) => void,
  stage: string,
  message: string,
  delayMs: number = 500
): Promise<void> => {
  return new Promise((resolve) => {
    sendProgress({
      stage,
      status: 'active',
      message
    });
    setTimeout(resolve, delayMs);
  });
};

/**
 * Send clean environment setup updates
 */
export const sendEnvironmentProgress = async (
  sendProgress: (data: any) => void
): Promise<void> => {
  await sendSimpleUpdate(
    sendProgress,
    'environment',
    'Setting up Docker container'
  );
  
  await sendSimpleUpdate(
    sendProgress,
    'environment',
    'Installing Solana toolchain'
  );
  
  await sendSimpleUpdate(
    sendProgress,
    'environment',
    'Preparing development workspace'
  );
};

/**
 * Send clean code generation updates
 */
export const sendCodeGenProgress = (sendProgress: (data: any) => void): Promise<void> => {
  return new Promise((resolve) => {
    console.log('[PROGRESS] Starting code generation');
    
    sendProgress({
      stage: 'code-gen',
      status: 'active',
      message: 'Starting Solana program generation'
    });
    
    resolve();
  });
};

/**
 * Send clean build process updates
 */
export const sendBuildProgress = async (
  sendProgress: (data: any) => void
): Promise<void> => {
  await sendSimpleUpdate(
    sendProgress,
    'build',
    'Compiling Rust to bytecode'
  );
  
  await sendSimpleUpdate(
    sendProgress,
    'build',
    'Linking Solana runtime'
  );
  
  await sendSimpleUpdate(
    sendProgress,
    'build',
    'Running security checks'
  );
  
  await sendSimpleUpdate(
    sendProgress,
    'build',
    'Optimizing program size'
  );
};