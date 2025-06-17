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
  // Create a Set to track which instruction names we've seen
  const seenInstructions = new Set<string>();
  
  // Deduplicate instruction imports
  const instructionImports = instructions
    .filter(inst => {
      if (seenInstructions.has(inst.name)) return false;
      seenInstructions.add(inst.name);
      return true;
    })
    .map(inst => `pub use instructions::${inst.name}::*;`)
    .join('\n');
  
  // Reset the Set for function definitions
  seenInstructions.clear();
  
  const instructionDefs = instructions
    .filter(inst => {
      if (seenInstructions.has(inst.name)) return false;
      seenInstructions.add(inst.name);
      return true;
    })
    .map(inst => {
      const ctx = inst.context_name ?? `${toPascal(inst.name)}Context`;
      const param = inst.params_name ?? `${toPascal(inst.name)}Params`;
      // Each instruction string is formatted here.
      // Ensure no unescaped backticks if this were a template literal itself.
      // Newlines are preserved.
      const rustCode = [
        `    pub fn ${inst.name}(ctx: Context<${ctx}>, params: ${param}) -> Result<()> {`,
        `        // instruction file already exports \\\`${inst.name}\\\``,
        `        instructions::${inst.name}::${inst.name}(ctx, params)`,
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
  
  // Create Sets to track which instruction names we've seen
  const seenModules = new Set<string>();
  const seenUses = new Set<string>();
  
  // Deduplicate pub mod declarations
  const pubModLines = instructions
    .filter(inst => {
      if (seenModules.has(inst.name)) return false;
      seenModules.add(inst.name);
      return true;
    })
    .map(inst => `pub mod ${inst.name};`)
    .join('\n');
  
  // Deduplicate pub use declarations
  const pubUseLines = instructions
    .filter(inst => {
      if (seenUses.has(inst.name)) return false;
      seenUses.add(inst.name);
      return true;
    })
    .map(inst => `pub use ${inst.name}::*;`)
    .join('\n');
  
  return pubModLines + '\n\n' + pubUseLines;
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
    // Parse & canonicalise first so downstream generators see final names
    const { instructions: rawInstructions, state } = parseNodeDetails(projectState);

    // For each instruction, get the canonical name from the function signature
    for (const inst of rawInstructions) {
      const m = inst.code.match(/pub\s+fn\s+([a-zA-Z0-9_]+)/);
      if (m) inst.name = m[1];          // canonical symbol overrides draft
    }

    // Deduplicate instructions by name, keeping the first occurrence
    const unique = new Map<string, InstructionDetail>();
    for (const inst of rawInstructions) {
      if (!unique.has(inst.name)) {
        unique.set(inst.name, inst);
      }
    }
    const instructions = Array.from(unique.values());

    // Anchor expects: programs/<programName>/src/…
    const programRoot = `./programs/${programName}`;

    const srcDir: FileTreeItem = {
      name: "src",
      path: `${programRoot}/src`,
      type: "directory",
      children: [],
    };

    // Now all helpers see the *final* instruction names
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

    // This loop should be the one that writes individual instruction files
    // using the already canonicalized inst.name from the earlier loop.
    for (const inst of instructions) {
      instrDir.children?.push({
        name: `${inst.name}.rs`, // Uses inst.name which was canonicalized at the top
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