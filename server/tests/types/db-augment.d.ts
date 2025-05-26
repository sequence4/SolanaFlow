declare module 'src/config/database' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Pool { __resetFakeClient: () => void }
  export const __resetFakeClient: () => void;
} 