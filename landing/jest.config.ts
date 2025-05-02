import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const custom = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^.+\\.(css|scss)$': 'identity-obj-proxy',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(lucide-react)/)'
  ],
};

export default createJestConfig(custom); 