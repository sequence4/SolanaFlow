import { FileTreeItem } from "src/types/FileTreeItem";
import fs from 'fs/promises';           
import fsSync from 'fs';             
import path from "path";
import { allGeneratedFiles } from "./data";

export function flattenPaths(tree: any[]): string[] {
  const out: string[] = [];
  for (const n of tree ?? []) {
    if (n?.path) out.push(n.path);
    if (Array.isArray(n?.children)) out.push(...flattenPaths(n.children));
  }
  return out;
}

export async function dirToFileTree(current: string, webRoot: string): Promise<FileTreeItem> {
  const entries = await fs.readdir(current, { withFileTypes: true });

  const children: (FileTreeItem | undefined)[] = await Promise.all(
    entries.map(async entry => {
      const abs = path.join(current, entry.name);
      const SKIP_TOP = new Set([
        'node_modules', '.next', '.turbo',
        'out', 'dist', '.vercel', 'coverage',
        '.git', '.vscode', '.idea', '.DS_Store',
        '.pnpm-store'
      ]);
      if (SKIP_TOP.has(entry.name)) return undefined;
      if (
        entry.isDirectory() &&
        path.basename(current) === '.yarn' &&
        entry.name === 'cache'
      ) {
        return undefined;  
      }

      if (entry.isDirectory()) return dirToFileTree(abs, webRoot); 

      const code = await fs.readFile(abs, 'utf8');
      return {
        name: entry.name,
        path: `./web/${path.relative(webRoot, abs)}`, 
        type: 'file',
        code,
      };
    })
  );

  const relDir = path.relative(webRoot, current);
  return {
    name: path.basename(current),
    path: relDir ? `./web/${relDir}` : './web', 
    type: 'directory',
    children: children.filter(Boolean) as FileTreeItem[],
  };
}

export function findWebDir(): string {
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, 'web');
    if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Cannot locate top-level 'web' directory");
    }
    dir = parent;
  }
}

export const emitFileWritten = (sendProgress: (data: unknown) => void, isRustPhase: boolean = false): ((path: string, content: string) => Promise<void>) => {
  return async (path, content) => {
    const filename = path.split('/').pop() || '';
    sendProgress({
      event: 'file-written',
      path,
      content,
    });

    const isImportantFile = 
      filename.endsWith('.rs') ||
      filename.endsWith('.tsx') ||
      filename.endsWith('.ts') ||
      filename === 'package.json' ||
      filename === 'tsconfig.json' ||
      filename === 'tailwind.config.js' ||
      filename === 'next.config.js' ||
      filename.endsWith('.json');
    
    if (isImportantFile && content.trim() && content.length > 20) {
      const language = 
        filename.endsWith('.rs') ? 'rust' :
        filename.endsWith('.tsx') || filename.endsWith('.ts') ? 'typescript' :
        filename.endsWith('.json') ? 'json' :
        filename.endsWith('.js') ? 'javascript' : 'text';
      
      const displayContent = content.length > 400 
        ? content.substring(0, 400) + '\n\n// ... (truncated)'
        : content;
      
      allGeneratedFiles.push({
        filename: path,
        content: displayContent,
        language
      });
            
      sendProgress({
        type: 'code-generation', 
        stage: 'code-gen',
        status: 'active',
        message: isRustPhase 
          ? `Generated ${allGeneratedFiles.length} program files...`
          : `Generated ${allGeneratedFiles.length} frontend files...`,
        files: [...allGeneratedFiles] 
      });
      
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  };
};

/*
async function waitForAll(taskIds: string[]): Promise<{
  succeeded: string[];
  failed: string[];
}> {
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const id of taskIds) {
    if (!id) continue;
    try {
      const { task } = await pollTaskStatus(id);
      (task.status === 'succeed' || task.status === 'finished'
        ? succeeded
        : failed
      ).push(id);
    } catch (err) {
      console.error(`[GEN] pollTaskStatus error for ${id}:`, err);
      failed.push(id);
    }
  }
  return { succeeded, failed };
}
*/