import { rmSync } from 'node:fs';

try {
  rmSync('.cache/ts-jest', { recursive: true, force: true });
} catch (error) {
  // Ignore errors if directory doesn't exist
  console.log('Note: No ts-jest cache to clear or error clearing cache');
} 