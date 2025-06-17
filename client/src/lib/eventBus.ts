import mitt from 'mitt';

/** Narrow typings for better DX */
export type ProgressPayload = Record<string, unknown>;

type BusEvents = {
  progress: ProgressPayload;
  'chat-build-command': void;  // Event emitted when user types "build" in the chat
  'file-arrival': string;      // Event emitted when a file arrives (for ticker)
  'typing-start': void;        // Event emitted when file content typing starts
  'typing-done': void;         // Event emitted when file content typing completes
};

const eventBus = mitt<BusEvents>();
export default eventBus; 