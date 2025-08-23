export const SKIP_FOLDERS = [
    '.anchor', '.github', '.git', 'target', 'node_modules',
    '.next', '.yarn', '.turbo', 'dist', 'build', 'coverage',
    '__pycache__', '.pytest_cache', '.mypy_cache', '.cache',
    'target/debug', 'target/release', '.vscode', '.idea'
  ];
export const SKIP_FILES = [
    'Cargo.lock',
    'package-lock.json',
    'yarn.lock',
    '.DS_Store',
    '.gitignore',
    '.prettierignore',
  ];
  
export interface FileNode {
    name: string;
    type: 'file' | 'directory';
    ext?: string;
    path: string;
    children?: FileNode[];
    content?: string;
}

export const CODE_EXTENSIONS = new Set([
  'rs', 'ts', 'tsx', 'js', 'jsx',
  'toml', 'json', 'md', 'css', 'scss',
  'html', 'yml', 'yaml', 'sol', 'move',
  'py', 'go', 'java', 'c', 'cpp', 'h',
  'sh', 'bash', 'zsh', 'fish', 'dockerfile',
  'txt', 'cfg', 'ini', 'env'
]);

export const SKIP_DIRS = new Set([
  '.next',
  'node_modules', 
  '.yarn',
  '.git',
  'target',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target/debug',
  'target/release'
]);

export const BIN_PATTERN = /\.(png|jpe?g|gif|ico|wasm|so|ttf|woff2?)$/i;
