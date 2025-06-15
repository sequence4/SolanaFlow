import mitt from 'mitt';

/** Narrow typings for better DX */
export type ProgressPayload = Record<string, unknown>;

type BusEvents = {
  progress: ProgressPayload;
};

const eventBus = mitt<BusEvents>();
export default eventBus; 