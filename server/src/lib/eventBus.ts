/** Server-side event bus for internal progress tracking */
export type ProgressPayload = {
  type: string;
  stage: string;
  message: string;
  pct: number;
  timestamp: number;
  [key: string]: unknown;
};

type ServerBusEvents = {
  progress: ProgressPayload;
  'task-start': { taskId: string; taskName: string; stage: string };
  'task-update': { taskId: string; pct: number; message?: string };
  'task-complete': { taskId: string; message?: string };
};

class SimpleEventBus {
  private listeners: Map<string, Function[]> = new Map();

  on<K extends keyof ServerBusEvents>(type: K, handler: (event: ServerBusEvents[K]) => void) {
    if (!this.listeners.has(type as string)) {
      this.listeners.set(type as string, []);
    }
    this.listeners.get(type as string)!.push(handler);
  }

  off<K extends keyof ServerBusEvents>(type: K, handler: (event: ServerBusEvents[K]) => void) {
    const handlers = this.listeners.get(type as string);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit<K extends keyof ServerBusEvents>(type: K, event: ServerBusEvents[K]) {
    const handlers = this.listeners.get(type as string);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${type as string}:`, error);
        }
      });
    }
  }
}

const eventBus = new SimpleEventBus();
export default eventBus;