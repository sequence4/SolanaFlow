import mitt from 'mitt';

/** Narrow typings for better DX */
export type ProgressPayload = Record<string, unknown>;

type BusEvents = {
  progress: ProgressPayload;
  'chat-build-command': void;  // Event emitted when user types "build" in the chat
  'build-complete': void;      // Event emitted when build completes successfully
  'file-arrival': string;      // Event emitted when a file arrives (for ticker)
  'typing-start': void;        // Event emitted when file content typing starts
  'typing-done': void;         // Event emitted when file content typing completes
  'file-written': { event: 'file-written'; path: string; content: string; }; // Server sent file data
  'code-generation': { type: 'code-generation'; files: Array<{ filename: string; content: string; language: string; }>; }; // Code generation event
};

const eventBus = mitt<BusEvents>();
export default eventBus; 