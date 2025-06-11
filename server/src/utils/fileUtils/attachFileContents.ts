import { promises as fs } from "fs";
import path from "path";

/** Predicate: which files should be sent with content eagerly? */
export function isImportant(pathInProj: string): boolean {
  // adjust if you later want tests, README, etc.
  return (
    /^(Anchor\.toml|Cargo\.toml)$/.test(pathInProj) ||      // configs
    /^programs\/[^/]+\/Cargo\.toml$/.test(pathInProj) ||    // per-program manifest
    /^programs\/[^/]+\/src\/.*\.rs$/.test(pathInProj)       // all Rust sources
  );
}

/** Mutate `tree` in place, adding `.code` + `.status` where applicable. */
export async function attachFileContents(
  tree: any[],
  absRoot: string             // absolute host path to project root
): Promise<any[]> {
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
          .catch(() => { /* leave empty, but don't fail pipeline */ })
      );
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };

  tree.forEach(walk);
  await Promise.all(tasks);
  return tree;
} 