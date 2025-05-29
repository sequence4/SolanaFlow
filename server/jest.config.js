/* eslint-env node */
/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@db$': '<rootDir>/tests/__mocks__/@db.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  testPathIgnorePatterns: ['<rootDir>/dist', '/node_modules/'],
  resetMocks: true,
  restoreMocks: true
};
