const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions }        = require('./tsconfig.json');

/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.(spec|test).ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),

  testPathIgnorePatterns: ['<rootDir>/dist', '/node_modules/'],
};
