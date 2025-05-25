/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src'],

  testMatch: ['**/__tests__/**/*.(spec|test).ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$'  : '<rootDir>/src/$1'
  },

  testPathIgnorePatterns: ['<rootDir>/dist', '/node_modules/']
};
