import '@testing-library/jest-dom'
import 'whatwg-fetch';
import { jest } from '@jest/globals';

jest.mock('canvas-confetti', () => () => {});

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
})); 