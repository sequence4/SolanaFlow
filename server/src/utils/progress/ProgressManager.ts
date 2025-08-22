import { EventEmitter } from 'events';

// Helper function to clean messages (remove emojis and extra formatting)
function cleanMessage(msg: string): string {
  return msg
    .replace(/[^\x00-\x7F]/g, '') // Remove all non-ASCII characters (emojis)
    .replace(/:\s*/g, '') // Remove colons
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export interface ProgressEvent {
  id: string;
  type: 'progress' | 'code-generation' | 'log' | 'status';
  stage: 'environment' | 'code-gen' | 'build' | 'deploy';
  process: string; // Specific process name
  message: string;
  pct: number;
  estimatedTimeRemaining?: number; // in seconds
  details?: {
    current?: number;
    total?: number;
    files?: Array<{
      filename: string;
      content: string;
      language: string;
    }>;
  };
  timestamp: number;
}

export class ProgressManager extends EventEmitter {
  private currentProgress: Map<string, ProgressEvent> = new Map();
  private sendProgress: (data: any) => void;
  private startTimes: Map<string, number> = new Map();
  
  constructor(sendProgress: (data: any) => void) {
    super();
    this.sendProgress = sendProgress;
  }
  
  // Track a new process with estimated duration
  startProcess(
    stage: ProgressEvent['stage'], 
    process: string, 
    estimatedDuration: number = 60
  ): string {
    const id = `${stage}-${process}-${Date.now()}`;
    const startTime = Date.now();
    this.startTimes.set(id, startTime);
    
    const event: ProgressEvent = {
      id,
      type: 'progress',
      stage,
      process,
      message: cleanMessage(`Starting ${process}...`),
      pct: 0,
      estimatedTimeRemaining: estimatedDuration,
      timestamp: startTime
    };
    
    this.currentProgress.set(id, event);
    this.sendProgress(event);
    
    //console.log('[PROGRESS-MGR] Started process:', id, 'at stage:', stage, 'pct:', 0);
    return id;
  }
  
  // Update process progress
  updateProcess(
    id: string, 
    pct: number, 
    message?: string,
    details?: ProgressEvent['details']
  ) {
    const progress = this.currentProgress.get(id);
    if (!progress) {
      console.warn('[PROGRESS-MGR] Cannot update unknown process:', id);
      return;
    }
    
    const startTime = this.startTimes.get(id) || Date.now();
    const elapsed = (Date.now() - startTime) / 1000;
    const estimatedTotal = pct > 0 ? elapsed / (pct / 100) : 60;
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
    
    const event: ProgressEvent = {
      ...progress,
      type: 'progress', // Ensure type is explicitly set
      pct,
      message: cleanMessage(message || progress.message),
      estimatedTimeRemaining: estimatedRemaining,
      details,
      timestamp: Date.now()
    };
    
    this.currentProgress.set(id, event);
    this.sendProgress(event);
    
    //console.log(`[PROGRESS-MGR] ${progress.stage}:${progress.process} → ${pct}% (${message || progress.message})`);
  }
  
  // Complete a process
  completeProcess(id: string, message?: string) {
    const progress = this.currentProgress.get(id);
    if (!progress) {
      console.warn('[PROGRESS-MGR] Cannot complete unknown process:', id);
      return;
    }
    
    const event: ProgressEvent = {
      ...progress,
      type: 'progress', // Ensure type is explicitly set
      pct: 100,
      message: cleanMessage(message || `${progress.process} completed`),
      estimatedTimeRemaining: 0,
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
    //console.log(`[PROGRESS-MGR] Completed ${progress.stage}:${progress.process} → 100%`);
    
    // Delay before cleanup to allow frontend to show completion
    setTimeout(() => {
      this.currentProgress.delete(id);
      this.startTimes.delete(id);
    }, 1000);
  }
  
  // Send code generation files
  sendCodeFiles(files: Array<{filename: string, content: string, language: string}>) {
    const event: ProgressEvent = {
      id: `code-files-${Date.now()}`,
      type: 'code-generation',
      stage: 'code-gen',
      process: 'file-generation',
      message: cleanMessage(`Generated ${files.length} files`),
      pct: 100,
      details: { files },
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
  
  // Get all active processes
  getActiveProcesses(): ProgressEvent[] {
    return Array.from(this.currentProgress.values());
  }
  
  // Clear all processes (cleanup)
  clearAll() {
    this.currentProgress.clear();
    this.startTimes.clear();
  }
  
  // Error handling
  errorProcess(id: string, error: string) {
    const progress = this.currentProgress.get(id);
    if (!progress) return;
    
    const event: ProgressEvent = {
      ...progress,
      pct: 0,
      message: cleanMessage(`Error: ${error}`),
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
}