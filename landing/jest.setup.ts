import '@testing-library/jest-dom'
import 'whatwg-fetch';
import { jest } from '@jest/globals';
import React from 'react';
import { rmSync } from 'node:fs';

jest.mock('canvas-confetti', () => () => {});

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import 'jest-axe/extend-expect';

jest.mock('next/image', () => ({ 
  __esModule: true, 
  default: (p) => React.createElement('img', { ...p, alt: p.alt || '' })
})); 

// Clear ts-jest cache to ensure we're always testing against the latest code
try {
  rmSync('.cache/ts-jest', { recursive: true, force: true });
} catch (error) {
  // Ignore errors if directory doesn't exist
  console.log('Note: No ts-jest cache to clear or error clearing cache');
} 