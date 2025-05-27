import {
  InstructionDetail,
  StateDetail,
  LibFileDetail,
  ModFileDetail,
} from "../../types/fileDetailInterfaces";
import { ServerProjectState } from "../../types/ServerProjectState";

/**  High-level parser : pick on-chain instruction nodes and basic state nodes  */
export function parseNodeDetails(
  projectState: ServerProjectState
): {
  instructions: InstructionDetail[];
  state: StateDetail[];
  lib: LibFileDetail[];
  mod: ModFileDetail;
} {
  const { nodes, edges } = projectState;

  /* ---- simple heuristic to mark on-chain instructions ---- */
  const instructions: InstructionDetail[] = nodes
    .filter((n: any) =>
      ["instructionNode", "instructionGroupNode"].includes(n.type)
    )
    .map((n: any, i: number) => {
      const label = n.data?.label || `instr_${i}`;
      const snake = label.toLowerCase().replace(/\s+/g, "_");
      const pascal = snake
        .split("_")
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");

      return {
        name: snake,
        code:
          (n.data?.code as string | undefined) ||
          `// TODO: implement ${snake}`,
        context_name: `${pascal}Context`,
        params_name: `${pascal}Params`,
        error_enum_name: `${pascal}Error`,
        hasState: false,
      };
    });

  /* ---- minimal state parsing ---- */
  const state: StateDetail[] = nodes
    .filter((n: any) => n.type === "accountNode" && n.data?.role === "program_account")
    .map((n: any) => ({
      struct_name: (n.data.label || "State").replace(/\s+/g, ""),
      fields: (n.data.fields ?? []).map((f: any) => ({
        name: f.label || "field",
        type: f.type || "u64",
      })),
    }));

  const lib: LibFileDetail[] = instructions.map((i) => ({
    instruction_name: i.name,
    context: i.context_name,
    params: i.params_name,
  }));

  const mod: ModFileDetail = { instructions: instructions.map((i) => i.name) };

  /* tag hasState=true if state exists */
  if (state.length) instructions.forEach((i) => (i.hasState = true));

  return { instructions, state, lib, mod };
}