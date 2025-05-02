import '@testing-library/jest-dom'
import 'whatwg-fetch';
import { jest } from '@jest/globals';
import React from 'react';

jest.mock('canvas-confetti', () => () => {});

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import 'jest-axe/extend-expect';

jest.mock('next/image', () => ({ 
  __esModule: true, 
  default: (p) => React.createElement('img', { ...p, alt: p.alt || '' })
})); 