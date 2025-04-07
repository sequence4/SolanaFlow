import { InstructionDetail, LibFileDetail, StateDetail } from '@/interfaces/fileDetailInterfaces';

export const getModRsTemplate = (instructions: string[], additionalContext?: string): string => {
    const imports = instructions.map((name) => `pub mod ${name};`).join('\n');
    const exports = instructions.map((name) => `pub use ${name}::*;`).join('\n');
  
    return [
      additionalContext ? `// ${additionalContext}` : '',
      exports,
      '',
      imports
    ].filter(Boolean).join('\n');
};

export function getInstructionTemplate(
  details: InstructionDetail,
  _functionLogic: string = '// AI_FUNCTION_LOGIC',
  hasState: boolean = false
): string {
  // Optional doc comment, becomes #[doc = "..."]
  const docComment = details.doc_description
    ? `#[doc = r"${details.doc_description}"]`
    : '';

  const instructionName = details.name;
  const contextStructName = details.context_name;
  const paramsStructName = details.params_name;
  // We allow an optional error_enum_name. If it's not provided, you could fallback
  // to something like `PascalCaseError` or just leave it mandatory.
  const errorEnumName = details.error_enum_name ?? 'DefaultErrorName';

  // Build any extra imports
  const parsedImports = (details.imports || [])
    .map(({ module, items }: { module: string, items: string[] }) => {
      // If items is ['*'], then `use module::*;`
      // Otherwise `use module::{Item1, Item2};`
      if (items.length === 1 && items[0] === '*') {
        return `use ${module}::*;`;
      }
      return `use ${module}::{${items.join(', ')}};`;
    })
    .join('\n');

  // Conditionally include state import
  const stateImport = hasState ? 'use crate::state::*;' : '';

  // Build the Accounts struct
  // e.g. `[account(init, payer = payer)] pub mint: Account<'info, Mint>,`
  const accountsStruct = (details.accounts || [])
    .map(({ name, type, constraints }) => {
      // e.g. constraints = ["init", "payer = payer"]
      const accountConstraints = constraints?.length
        ? `#[account(${constraints.join(', ')})]\n`
        : '';

      // Use the `type` to decide how we declare the account field
      if (type === 'Account') {
        return `${accountConstraints}    pub ${name.snake}: Account<'info, ${name.pascal}>,`;
      }
      if (type === 'Signer') {
        return `${accountConstraints}    pub ${name.snake}: Signer<'info>,`;
      }
      if (type === 'Program') {
        return `${accountConstraints}    pub ${name.snake}: Program<'info, System>,`;
      }
      if (type === 'Sysvar') {
        return `${accountConstraints}    pub ${name.snake}: Sysvar<'info, Rent>,`;
      }

      // Otherwise just treat it as a raw type string
      return `${accountConstraints}    pub ${name.snake}: ${type},`;
    })
    .join('\n');

  // Build the Params struct
  // e.g. `pub decimals: u8, pub authority: Pubkey, ...`
  const paramsStruct = (details.params || [])
    .map(({ name, type }) => `    pub ${name}: ${type},`)
    .join('\n');

  // Build the events (if any)
  // e.g. 
  // #[event]
  // pub struct MyEvent {
  //     pub field1: u64,
  //     pub field2: String,
  // }
  const eventsStruct = (details.events || [])
    .map(event => `
#[event]
pub struct ${event.name} {
    ${event.fields
      .map(field => `pub ${field.name}: ${field.type},`)
      .join('\n    ')}
}
`)
    .join('\n');

  // Build the error codes (if any)
  // e.g. 
  // #[error_code]
  // pub enum MyError {
  //     #[msg("Must have enough tokens")]
  //     InsufficientTokens,
  // }
  const errorCodesStruct = (details.error_codes || [])
    .map(({ name, msg }) => `    #[msg("${msg}")] ${name},`)
    .join('\n');

  // Check if the function logic already contains a context struct definition
  const hasContextStruct = _functionLogic.includes('#[derive(Accounts)]') && 
                          _functionLogic.includes(`struct ${contextStructName}`);

  // Only include the context struct if it's not already defined in the function logic
  const contextStructDefinition = hasContextStruct ? '' : `
#[derive(Accounts)]
pub struct ${contextStructName}<'info> {
${accountsStruct}
}`;

  // Return the final Rust source code with conditional state import
  return `
use anchor_lang::prelude::*;
${stateImport}
${parsedImports}

${docComment}
pub fn ${instructionName}(ctx: Context<${contextStructName}>, params: ${paramsStructName}) -> Result<()> {
    ${_functionLogic}
}

${contextStructDefinition}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ${paramsStructName} {
${paramsStruct}
}

#[error_code]
pub enum ${errorEnumName} {
${errorCodesStruct}
}

${eventsStruct}
`;
}

export function getLibRsTemplate(
    programName: string,
    programId: string,
    fileDetails: LibFileDetail[],
    hasState: boolean = false
  ): string {
    // Optional: Logging or debugging
    console.log("Lib fileDetails", fileDetails);
  
    // Build each "program function" wrapper by iterating over the LibFileDetail array
    const programFunctions = fileDetails
      .map(({ instruction_name, context, params }) => {
        // We'll use the same field for the module name
        const moduleName = instruction_name;
        // For the function name, we'll use the original function name from the instruction file
        // For example, if instruction_name is "initialize_mint", we'll call "initialize_mint"
        const functionName = instruction_name;
        const contextStruct = context;
        const paramsStruct = params;
        return `
        pub fn ${functionName}(ctx: Context<${contextStruct}>, params: ${paramsStruct}) -> Result<()> {
            instructions::${moduleName}::${functionName}(ctx, params)
        }`;
      })
      .join('\n');
  
    // Conditionally include the state module
    const stateModLine = hasState ? "pub mod state;" : "";
  
    // Return the final lib.rs content
    return `
    use anchor_lang::prelude::*;
  
    pub mod instructions;
    ${stateModLine}
    use instructions::*;
  
    declare_id!("${programId}");
  
    #[program]
    pub mod ${programName} {
        use super::*;
        
        ${programFunctions}
    }
    `;
}

export function getStateTemplate(fileDetails: StateDetail[]): string {
  // Filter program-defined accounts based on the 'role'
  const programAccountDetails = fileDetails.filter(
    (detail) => detail.role === 'program_account'
  );

  // Generate the Rust structs for each program-defined account
  const accounts = programAccountDetails
    .map(({ account_name, struct_name, fields, description }) => {
      // Build the fields for the struct
      const fieldsStr = fields
        .map(({ name, type, attributes }) => {
          // If attributes exist, prepend them above the field
          const attributeStr = attributes?.length
            ? attributes.map((attr) => `    #[${attr}]`).join('\n') + '\n'
            : '';
          return `${attributeStr}    pub ${name}: ${type},`;
        })
        .join('\n');

      // If there's a description, turn it into a doc attribute
      const descriptionStr = description
        ? `#[doc = "${description}"]\n`
        : '';

      // Finally, build the struct definition
      return `
${descriptionStr}#[account]
pub struct ${struct_name} {
${fieldsStr}
}
`;
    })
    .join('\n');

  // Wrap up with the standard Anchor prelude and the generated structs
  return `
use anchor_lang::prelude::*;

${accounts}
`;
}
