import { Buffer } from 'buffer';

// Set up global Buffer for libraries that expect it
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  (window as any).global = window;
  (global as any).Buffer = Buffer;
}

export {}; 