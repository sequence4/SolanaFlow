import { promises as fs } from "fs";
import path from "path";

/** Predicate: which files should be sent with content eagerly? */
export function isImportant(pathInProj: string): boolean {
  // Strip leading ./ prefix if present
  const p = pathInProj.replace(/^\.?\//, "");   // strip ./ ➡ absolute-in-repo
  
  // adjust if you later want tests, README, etc.
  return (
    /^(Anchor\.toml|Cargo\.toml)$/.test(p) ||      // configs
    /^programs\/[^/]+\/Cargo\.toml$/.test(p) ||    // per-program manifest
    /^programs\/[^/]+\/src\/.*\.rs$/.test(p)       // all Rust sources
  );
}

/** Mutate `tree` in place, adding `.code` + `.status` where applicable. */
export async function attachFileContents(
  tree: any[],
  absRoot: string             // absolute host path to project root
): Promise<void> {
  const tasks: Promise<void>[] = [];

  const walk = (node: any) => {
    if (node.type === "file" && isImportant(node.path)) {
      const full = path.join(absRoot, node.path);           // path.join handles "/" safely
      tasks.push(
        fs.readFile(full, "utf-8")
          .then(txt => {
            node.code = txt;
            node.status = "generated";
          })
          .catch((err: NodeJS.ErrnoException) => {
            if (err.code === "ENOENT") {
              console.warn(`[attachFileContents] Missing file: ${full}`);
            } else {
              console.error(`[attachFileContents] fs error:`, err);
            }
          })
      );
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };

  tree.forEach(walk);
  await Promise.all(tasks);
} 