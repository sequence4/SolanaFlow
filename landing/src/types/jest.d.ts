import '@testing-library/jest-dom';

declare global {
  // eslint-disable-next-line no-var
  var jest: unknown;
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: unknown): R;
    }
    function fn(implementation?: (...args: unknown[]) => unknown): unknown;
    function mock(moduleName: string, factory?: unknown): unknown;
  }
} 