"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollupConfigContent = exports.apiHelperContent = exports.tsConfig = exports.serverGitignoreContent = exports.serverEnvContent = exports.serverIndexContent = exports.readMeMd = void 0;
exports.serverPackageJson = serverPackageJson;
exports.rootPackageJson = rootPackageJson;
exports.readMeMd = `# Hello World
This is a placeholder README for the user project.
`;
function serverPackageJson(projectName) {
    return {
        name: `${projectName}-server`,
        version: '1.0.0',
        main: 'dist/index.js',
        scripts: {
            build: 'tsc -p tsconfig.json',
            start: 'node dist/index.js'
        },
        dependencies: {
            express: '^4.18.2'
        }
    };
}
function rootPackageJson(projectName) {
    return {
        name: projectName.replace(/[^\w-]/g, ''),
        version: '1.0.0',
        scripts: {}
    };
}
exports.serverIndexContent = `import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;
exports.serverEnvContent = `# .env
PORT=3001
`;
exports.serverGitignoreContent = `node_modules
dist
build
`;
exports.tsConfig = {
    compilerOptions: {
        target: 'es2020',
        module: 'commonjs',
        esModuleInterop: true,
        outDir: 'dist',
    },
    include: ['src']
};
exports.apiHelperContent = `import axios from 'axios';

export async function fetchData() {
  const res = await axios.get('/api');
  return res.data;
}
`;
exports.rollupConfigContent = `
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: './src/index.ts',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  external: ['react', 'react-dom'], // treat these as peer deps
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({ tsconfig: './tsconfig.json' })
  ]
});
`;
