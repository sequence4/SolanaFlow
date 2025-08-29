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
  details?: {
    files?: Array<{
      filename: string;
      content: string;
      language: string;
    }>;
  };
  timestamp: number;
}

export class ProgressManager extends EventEmitter {
  private sendProgress: (data: any) => void;
  
  constructor(sendProgress: (data: any) => void) {
    super();
    this.sendProgress = sendProgress;
  }
  
  // Track a new process
  startProcess(
    stage: ProgressEvent['stage'], 
    process: string
  ): string {
    const id = `${stage}-${process}-${Date.now()}`;
    
    const event: ProgressEvent = {
      id,
      type: 'progress',
      stage,
      process,
      message: cleanMessage(`Starting ${process}`),
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
    return id;
  }
  
  // Update process progress
  updateProcess(
    id: string, 
    _pct: number,  // Keep parameter for backward compatibility but ignore it
    message?: string,
    details?: ProgressEvent['details']
  ) {
    if (!message) return; // Skip updates without meaningful messages
    
    const event: ProgressEvent = {
      id,
      type: 'progress',
      stage: 'build', // Default stage
      process: 'update',
      message: cleanMessage(message),
      details,
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
  
  // Complete a process
  completeProcess(id: string, message?: string) {
    const event: ProgressEvent = {
      id,
      type: 'progress',
      stage: 'build', // Default stage
      process: 'complete',
      message: cleanMessage(message || 'Process completed'),
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
  
  // Send code generation files
  sendCodeFiles(files: Array<{filename: string, content: string, language: string}>) {
    const event: ProgressEvent = {
      id: `code-files-${Date.now()}`,
      type: 'code-generation',
      stage: 'code-gen',
      process: 'file-generation',
      message: cleanMessage(`Generated ${files.length} program files`),
      details: { files },
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
  
  // Error handling
  errorProcess(id: string, error: string) {
    const event: ProgressEvent = {
      id,
      type: 'progress',
      stage: 'build',
      process: 'error',
      message: cleanMessage(`Error: ${error}`),
      timestamp: Date.now()
    };
    
    this.sendProgress(event);
  }
}