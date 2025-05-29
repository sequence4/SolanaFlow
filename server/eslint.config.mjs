import { URL } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'

const baseDirectory = new URL('.', import.meta.url).pathname
const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended,
  baseDirectory,
})

export default [
  {
    ignores: ['dist/**/*'],
  },

  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ),

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-namespace': 'off',
    },
  },

  // ------------------------------------------------------------------
  // Jest / build config files — CommonJS, Node globals allowed
  // ------------------------------------------------------------------
  {
    files: ['server/jest.config.js'],   // add more *.cjs or *.config.js here if needed
    languageOptions: {
      sourceType: 'script',             // treat as CommonJS
      globals: {
        ...globals.node,                // expose `module`, `require`, etc.
      },
    },
    rules: {
      'no-undef': 'off',                // Node CJS globals are fine
    },
  },
]
