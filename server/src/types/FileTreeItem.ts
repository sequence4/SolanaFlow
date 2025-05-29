export interface FileTreeItem {
  name:     string;
  path:     string;
  type:     'file' | 'directory';
  code?:    string;
  children?: FileTreeItem[];
} 