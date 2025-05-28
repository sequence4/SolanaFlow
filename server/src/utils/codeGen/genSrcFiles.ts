import { FileTreeItem } from "../../types/FileTreeItem";
import { ServerProjectState } from "../../types/ServerProjectState";
import {
  InstructionDetail,
  StateDetail,
  LibFileDetail,
  ModFileDetail,
} from "../../types/fileDetailInterfaces";
import { parseNodeDetails } from "./parseNodeDetails";
import { templates } from './templates';

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

    // Generate individual instruction files
    for (const inst of instructions) {
      instrDir.children?.push({
        name: `${inst.name}.rs`,
        path: `${programRoot}/src/instructions/${inst.name}.rs`,
        type: "file",
        code: inst.code,
      });
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

function generateLibRs(programName: string, programId: string, instructions: InstructionDetail[], state: StateDetail[]): string {
  const instructionImports = instructions.map(inst => `pub use instructions::${inst.name}::*;`).join('\n');
  
  return `use anchor_lang::prelude::*;

declare_id!("${programId}");

pub mod instructions;
${state.length > 0 ? 'pub mod state;' : ''}

${instructionImports}

#[program]
pub mod ${programName} {
    use super::*;

${instructions.map(inst => `    pub fn ${inst.name}(ctx: Context<${inst.context_name}>) -> Result<()> {
        instructions::${inst.name}::${inst.name}(ctx)
    }`).join('\n\n')}
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
    return `#[account]
pub struct ${s.struct_name} {
${fields}
}`;
  }).join('\n\n');

  return `use anchor_lang::prelude::*;

${stateStructs}`;
}