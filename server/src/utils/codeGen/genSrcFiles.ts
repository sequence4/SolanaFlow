import { FileTreeItem } from "../../types/FileTreeItem";
import { ServerProjectState } from "../../types/ServerProjectState";

export function genSrcFiles(
  projectState: ServerProjectState,
  programName: string,
  programId: string
): FileTreeItem | null {
  try {
    // For now, create a minimal src structure until helper functions are implemented
    const srcDir: FileTreeItem = {
      name: "src",
      path: "./src",
      type: "directory",
      children: [],
    };

    // Basic lib.rs file
    srcDir.children?.push({
      name: "lib.rs",
      path: "./src/lib.rs",
      type: "file",
      code: `use anchor_lang::prelude::*;

declare_id!("${programId}");

#[program]
pub mod ${programName} {
    use super::*;

    // Generated instructions will be added here
}`,
    });

    // Instructions directory with mod.rs
    const instrDir: FileTreeItem = {
      name: "instructions",
      path: "./src/instructions",
      type: "directory",
      children: [],
    };

    instrDir.children?.push({
      name: "mod.rs",
      path: "./src/instructions/mod.rs",
      type: "file",
      code: "// Generated instruction modules will be declared here",
    });

    srcDir.children?.push(instrDir);

    // Basic state.rs if needed
    if (projectState.nodes && projectState.nodes.length > 0) {
      srcDir.children?.push({
        name: "state.rs",
        path: "./src/state.rs",
        type: "file",
        code: `use anchor_lang::prelude::*;

// Generated state structures will be added here`,
      });
    }

    return srcDir;
  } catch (error) {
    console.error("Error in genSrcFiles:", error);
    return null;
  }
}