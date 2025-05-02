import type { Config } from 'jest';
import { join } from 'path';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/lib/db$': '<rootDir>/src/__tests__/api/__mocks__/@/lib/db.ts',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/api/jest.setup.ts'],
  detectOpenHandles: true,
  modulePaths: [join(__dirname, './')],
};

export default config; 