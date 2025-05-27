export interface InstructionDetail {
  name: string;               // snake_case
  code: string;               // full Rust snippet
  context_name: string;
  params_name: string;
  error_enum_name: string;
  hasState: boolean;
}

export interface StateDetail {
  struct_name: string;
  fields: { name: string; type: string }[];
}

export interface LibFileDetail {
  instruction_name: string;
  context: string;
  params: string;
}

export interface ModFileDetail {
  instructions: string[];
} 