import '@testing-library/jest-dom';

declare global {
  // eslint-disable-next-line no-var
  var jest: any;
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
    function fn(implementation?: (...args: any[]) => any): any;
    function mock(moduleName: string, factory?: any): any;
  }
} 