import mitt from 'mitt';

/** Narrow typings for better DX */
export type ProgressPayload = Record<string, unknown>;

type BusEvents = {
  progress: ProgressPayload;
  'chat-build-command': void;  // Event emitted when user types "build" in the chat
};

const eventBus = mitt<BusEvents>();
export default eventBus; 