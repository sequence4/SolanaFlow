import { FileTreeItem } from "../../types/FileTreeItem";
import { ServerProjectState } from "../../types/ServerProjectState";
import {
  InstructionDetail,
  StateDetail,
  // LibFileDetail, // Not used directly in the moved functions
  // ModFileDetail, // Not used directly in the moved functions
} from "../../types/fileDetailInterfaces";
import { parseNodeDetails } from "./parseNodeDetails";
import { templates } from './templates';

// -------------------- Helper Function Definitions --------------------

function toPascal(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function generateLibRs(programName: string, programId: string, instructions: InstructionDetail[], state: StateDetail[]): string {
  const instructionImports = instructions.map(inst => `pub use instructions::${inst.name}::*;`).join('\n');
  
  const instructionDefs = instructions.map(inst => {
    const ctx = inst.context_name ?? `${toPascal(inst.name)}Context`;
    // Each instruction string is formatted here.
    // Ensure no unescaped backticks if this were a template literal itself.
    // Newlines are preserved.
    const rustCode = [
      `    pub fn ${inst.name}(ctx: Context<${ctx}>) -> Result<()> {`,
      `        // instruction file already exports \\\`${inst.name}\\\``,
      `        instructions::${inst.name}::${inst.name}(ctx)`,
      `    }`
    ].join('\n');
    return rustCode;
  }).join('\n\n');

  return `use anchor_lang::prelude::*;

declare_id!("${programId}");

pub mod instructions;
${state.length > 0 ? 'pub mod state;' : ''}

${instructionImports}

#[program]
pub mod ${programName} {
    use super::*;

${instructionDefs}
}`;
}

function generateModRs(instructions: InstructionDetail[]): string {
  if (instructions.length === 0) {
    return "// No instructions generated";
  }
  
  return instructions.map(inst => `pub mod ${inst.name};`).join('\n') + 
    '\n\n' + 
    instructions.map(inst => `pub use ${inst.name}::*;`).join('\n');
}

function generateStateRs(state: StateDetail[]): string {
  const stateStructs = state.map(s => {
    const fields = s.fields.map(f => `    pub ${f.name}: ${f.type},`).join('\n');
    // Struct definition string
    const structCode = [
      `#[account]`,
      `pub struct ${toPascal(s.struct_name)} {`,
      fields,
      `}`
    ].join('\n');
    return structCode;
  }).join('\n\n');

  return `use anchor_lang::prelude::*;

${stateStructs}`;
}

// -------------------- Main Exported Function --------------------

export function genSrcFiles(
  projectState: ServerProjectState,
  programName: string,
  programId: string
): FileTreeItem | null {
  try {
    // Parse the project state to get structured data
    const { instructions, state, lib, mod } = parseNodeDetails(projectState);

    // Anchor expects: programs/<programName>/src/…
    const programRoot = `./programs/${programName}`;

    const srcDir: FileTreeItem = {
      name: "src",
      path: `${programRoot}/src`,
      type: "directory",
      children: [],
    };

    // Generate lib.rs with proper program structure
    const libCode = generateLibRs(programName, programId, instructions, state);
    srcDir.children?.push({
      name: "lib.rs",
      path: `${programRoot}/src/lib.rs`,
      type: "file",
      code: libCode,
    });

    // Generate instructions directory
    const instrDir: FileTreeItem = {
      name: "instructions",
      path: `${programRoot}/src/instructions`,
      type: "directory",
      children: [],
    };

    // Generate mod.rs for instructions
    const modCode = generateModRs(instructions);
    instrDir.children?.push({
      name: "mod.rs",
      path: `${programRoot}/src/instructions/mod.rs`,
      type: "file",
      code: modCode,
    });

    // Choose the canonical Rust symbol by inspecting the snippet itself.
    for (const inst of instructions) {
      const fnMatch = inst.code.match(/pub\s+fn\s+([a-zA-Z0-9_]+)/);
      const canonical = fnMatch ? fnMatch[1] : inst.name;  // fallback

      instrDir.children?.push({
        name: `${canonical}.rs`,
        path: `${programRoot}/src/instructions/${canonical}.rs`,
        type: "file",
        code: inst.code,
      });

      // overwrite inst.name so later helpers (mod.rs/lib.rs) stay in sync
      inst.name = canonical;
    }

    srcDir.children?.push(instrDir);

    // Generate state.rs only if state exists
    if (state.length > 0) {
      const stateCode = generateStateRs(state);
      srcDir.children?.push({
        name: "state.rs",
        path: `${programRoot}/src/state.rs`,
        type: "file",
        code: stateCode,
      });
    }

    // ───────────────── Cargo.toml ─────────────────
    srcDir.children?.push({
      name: "Cargo.toml",
      path: `${programRoot}/Cargo.toml`,
      type: "file",
      code: templates.programCargoToml(programName),
    });

    return srcDir;
  } catch (error) {
    console.error("Error in genSrcFiles:", error);
    return null;
  }
}