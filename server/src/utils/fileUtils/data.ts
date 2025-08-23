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