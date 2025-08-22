import {
  EnhancedInstructionNodeData,
  EnhancedAccount,
  EnhancedParameter,
  EnhancedErrorCode,
  EnhancedEvent,
  AccountType,
  ParameterType,
  ErrorSeverity,
  ValidationStatus,
  ValidationRule,
  categorizeInstruction,
  estimateCost
} from '@/types/EnhancedInstructionTypes';

// Legacy interface (based on existing InstructionNode)
interface LegacyAccount {
  label: string;
  type: string;
  description?: string;
  info?: any;
  isWritable?: boolean;
  isSigner?: boolean;
}

interface LegacyParameter {
  label: string;
  type: string;
  value?: string;
}

interface LegacyErrorCode {
  name: string;
  message: string;
}

interface LegacyEvent {
  name: string;
  type?: string;
  description: string;
  fields?: Array<{ name: string; type: string }>;
}

interface LegacyInstructionNodeData {
  label: string;
  description?: string;
  accounts?: LegacyAccount[];
  parameters?: LegacyParameter[];
  errorCodes?: LegacyErrorCode[];
  events?: LegacyEvent[];
  code?: string;
}

// Mapping functions
function mapAccountType(legacyType: string): AccountType {
  switch (legacyType.toLowerCase()) {
    case 'accountinfo':
      return AccountType.ACCOUNT_INFO;
    case 'program':
      return AccountType.PROGRAM;
    case 'sysvar':
      return AccountType.SYSVAR;
    case 'tokenaccount':
      return AccountType.TOKEN_ACCOUNT;
    case 'mint':
      return AccountType.MINT;
    case 'associatedtokenaccount':
    case 'ata':
      return AccountType.ASSOCIATED_TOKEN_ACCOUNT;
    case 'multisig':
      return AccountType.MULTISIG;
    case 'signer':
      return AccountType.ACCOUNT_INFO; // Signer is a property, not a type
    default:
      return AccountType.UNKNOWN;
  }
}

function mapParameterType(legacyType: string): ParameterType {
  const type = legacyType.toLowerCase();
  
  if (type.includes('u8')) return ParameterType.U8;
  if (type.includes('u16')) return ParameterType.U16;
  if (type.includes('u32')) return ParameterType.U32;
  if (type.includes('u64')) return ParameterType.U64;
  if (type.includes('u128')) return ParameterType.U128;
  if (type.includes('i8')) return ParameterType.I8;
  if (type.includes('i16')) return ParameterType.I16;
  if (type.includes('i32')) return ParameterType.I32;
  if (type.includes('i64')) return ParameterType.I64;
  if (type.includes('i128')) return ParameterType.I128;
  if (type.includes('bool')) return ParameterType.BOOL;
  if (type.includes('string')) return ParameterType.STRING;
  if (type.includes('pubkey')) return ParameterType.PUBKEY;
  if (type.includes('bytes')) return ParameterType.BYTES;
  if (type.includes('option')) return ParameterType.OPTIONAL;
  if (type.includes('vec')) return ParameterType.VEC;
  
  return ParameterType.STRING; // Default fallback
}

function convertAccount(legacyAccount: LegacyAccount): EnhancedAccount {
  const accountType = mapAccountType(legacyAccount.type);
  const isSigner = legacyAccount.isSigner || (legacyAccount.type.toLowerCase() === 'signer');
  
  // Smart writable detection based on account role
  const isWritable = legacyAccount.isWritable || 
    legacyAccount.label.toLowerCase().includes('destination') ||
    legacyAccount.label.toLowerCase().includes('mint') ||
    legacyAccount.label.toLowerCase().includes('payer') ||
    accountType === AccountType.MINT ||
    accountType === AccountType.TOKEN_ACCOUNT;
  
  return {
    label: legacyAccount.label,
    type: accountType,
    description: legacyAccount.description || generateAccountDescription(legacyAccount.label, accountType),
    isWritable,
    isSigner,
    publicKey: generateAccountAddress(accountType, legacyAccount.label),
    owner: getAccountOwner(accountType),
    lamports: getAccountLamports(accountType),
    rentEpoch: accountType === AccountType.PROGRAM ? undefined : '18446744073709551615'
  };
}

function convertParameter(legacyParameter: LegacyParameter): EnhancedParameter {
  const paramType = mapParameterType(legacyParameter.type);
  return {
    label: legacyParameter.label,
    type: paramType,
    value: legacyParameter.value,
    required: true,
    description: generateParameterDescription(legacyParameter.label, legacyParameter.type),
    validation: generateValidationRules(paramType, legacyParameter.label)
  };
}

function convertErrorCode(legacyError: LegacyErrorCode): EnhancedErrorCode {
  return {
    name: legacyError.name,
    message: legacyError.message,
    severity: inferErrorSeverity(legacyError.name, legacyError.message),
    resolution: generateErrorResolution(legacyError.name)
  };
}

function convertEvent(legacyEvent: LegacyEvent): EnhancedEvent {
  return {
    name: legacyEvent.name,
    type: legacyEvent.type,
    description: legacyEvent.description,
    fields: legacyEvent.fields?.map(field => ({
      name: field.name,
      type: field.type,
      description: `${field.name} field of type ${field.type}`
    }))
  };
}

// Helper functions
function generatePlaceholderAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateAccountAddress(accountType: AccountType, label?: string): string {
  // Return known addresses for common account types
  switch (accountType) {
    case AccountType.PROGRAM:
      if (label?.toLowerCase().includes('token')) {
        return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      }
      if (label?.toLowerCase().includes('system')) {
        return '11111111111111111111111111111112';
      }
      if (label?.toLowerCase().includes('associated')) {
        return 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
      }
      return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    case AccountType.MINT:
      return 'So11111111111111111111111111111111111111112'; // SOL mint
    case AccountType.SYSVAR:
      return 'Rent1111111111111111111111111111111111111111';
    default:
      // Generate more realistic looking addresses
      const prefixes = ['1234', '5678', '9ABC', 'DEF0', '2468', '1357'];
      const suffixes = ['xyz', 'abc', '123', 'def', '456', 'ghi'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      return prefix + generatePlaceholderAddress().slice(4, -3) + suffix;
  }
}

function getAccountOwner(accountType: AccountType): string | undefined {
  switch (accountType) {
    case AccountType.PROGRAM:
      return undefined; // Programs don't have owners
    case AccountType.TOKEN_ACCOUNT:
    case AccountType.ASSOCIATED_TOKEN_ACCOUNT:
    case AccountType.MINT:
    case AccountType.MULTISIG:
      return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    case AccountType.SYSVAR:
      return 'Sysvar1111111111111111111111111111111111111';
    default:
      return '11111111111111111111111111111112'; // System program
  }
}

function getAccountLamports(accountType: AccountType): string {
  switch (accountType) {
    case AccountType.PROGRAM:
      return '1.00000000'; // Programs typically have 1 SOL minimum
    case AccountType.TOKEN_ACCOUNT:
    case AccountType.ASSOCIATED_TOKEN_ACCOUNT:
    case AccountType.MINT:
      return '0.00203928'; // Rent-exempt minimum for token accounts
    case AccountType.SYSVAR:
      return '0.00000001'; // Sysvars have minimal balance
    default:
      return '1.00000000'; // Default user account balance
  }
}

function generateAccountDescription(label: string, accountType: AccountType): string {
  const lowerLabel = label.toLowerCase();
  
  // Generate smart descriptions based on label and type
  if (lowerLabel.includes('mint')) {
    return 'Token mint account that defines the properties of the token';
  }
  if (lowerLabel.includes('destination') || lowerLabel.includes('recipient')) {
    return 'The account that will receive tokens from this operation';
  }
  if (lowerLabel.includes('source') || lowerLabel.includes('sender')) {
    return 'The account that will send tokens in this operation';
  }
  if (lowerLabel.includes('authority') || lowerLabel.includes('owner')) {
    return 'The account with authority to authorize this operation';
  }
  if (lowerLabel.includes('program')) {
    return 'The Solana program that will execute this instruction';
  }
  if (lowerLabel.includes('associated')) {
    return 'Associated token account derived from owner and mint';
  }
  if (lowerLabel.includes('multisig')) {
    return 'Multi-signature account requiring multiple signatures';
  }
  
  // Fallback based on account type
  switch (accountType) {
    case AccountType.PROGRAM:
      return 'Solana program that executes blockchain instructions';
    case AccountType.MINT:
      return 'Token mint defining the properties and supply of a token';
    case AccountType.TOKEN_ACCOUNT:
      return 'Account that holds tokens of a specific mint';
    case AccountType.ASSOCIATED_TOKEN_ACCOUNT:
      return 'Token account automatically derived from owner and mint addresses';
    case AccountType.SYSVAR:
      return 'System variable account containing blockchain state information';
    case AccountType.MULTISIG:
      return 'Multi-signature account requiring multiple approvals for operations';
    default:
      return `${label} account used in this instruction`;
  }
}

function generateParameterDescription(label: string, type: string): string {
  const descriptions: { [key: string]: string } = {
    'amount': 'The number of tokens to process in this instruction',
    'decimals': 'Number of decimal places for the token',
    'authority': 'The account that has authority to perform this action',
    'mint': 'The token mint account',
    'destination': 'The account that will receive the tokens',
    'source': 'The account that will send the tokens',
    'owner': 'The owner of the token account'
  };

  const lowerLabel = label.toLowerCase();
  for (const [key, desc] of Object.entries(descriptions)) {
    if (lowerLabel.includes(key)) {
      return desc;
    }
  }

  return `${label} parameter of type ${type}`;
}

function generateValidationRules(paramType: ParameterType, label: string): ValidationRule[] {
  const rules: ValidationRule[] = [
    {
      type: 'required',
      message: `${label} is required`
    }
  ];

  // Add type-specific validation rules
  switch (paramType) {
    case ParameterType.U8:
      rules.push(
        { type: 'min', value: 0, message: 'Value must be 0 or greater' },
        { type: 'max', value: 255, message: 'Value must be 255 or less' }
      );
      break;
    case ParameterType.U16:
      rules.push(
        { type: 'min', value: 0, message: 'Value must be 0 or greater' },
        { type: 'max', value: 65535, message: 'Value must be 65535 or less' }
      );
      break;
    case ParameterType.U32:
      rules.push(
        { type: 'min', value: 0, message: 'Value must be 0 or greater' },
        { type: 'max', value: 4294967295, message: 'Value must be 4294967295 or less' }
      );
      break;
    case ParameterType.U64:
      rules.push(
        { type: 'min', value: 0, message: 'Value must be 0 or greater' }
      );
      break;
    case ParameterType.PUBKEY:
      rules.push({
        type: 'pattern',
        value: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        message: 'Must be a valid base58 public key (32-44 characters)'
      });
      break;
    case ParameterType.BOOL:
      rules.push({
        type: 'pattern',
        value: /^(true|false|0|1)$/i,
        message: 'Must be true, false, 0, or 1'
      });
      break;
  }

  // Add label-specific rules
  if (label.toLowerCase().includes('amount')) {
    rules.push({
      type: 'min',
      value: 1,
      message: 'Amount must be greater than 0'
    });
  }

  return rules;
}

function inferErrorSeverity(name: string, message: string): ErrorSeverity {
  const criticalKeywords = ['unauthorized', 'insufficient', 'invalid owner', 'frozen'];
  const highKeywords = ['not found', 'already exists', 'overflow', 'underflow'];
  const mediumKeywords = ['invalid', 'mismatch', 'wrong'];

  const lowerName = name.toLowerCase();
  const lowerMessage = message.toLowerCase();
  const combined = `${lowerName} ${lowerMessage}`;

  if (criticalKeywords.some(keyword => combined.includes(keyword))) {
    return ErrorSeverity.CRITICAL;
  }
  if (highKeywords.some(keyword => combined.includes(keyword))) {
    return ErrorSeverity.HIGH;
  }
  if (mediumKeywords.some(keyword => combined.includes(keyword))) {
    return ErrorSeverity.MEDIUM;
  }
  
  return ErrorSeverity.LOW;
}

function generateErrorResolution(errorName: string): string {
  const resolutions: { [key: string]: string } = {
    'unauthorized': 'Ensure the signing account has proper authority',
    'insufficient': 'Check account balance and token amounts',
    'frozen': 'Account must be unfrozen before this operation',
    'invalid': 'Verify all account addresses and parameters',
    'not found': 'Ensure the account exists and is properly initialized',
    'overflow': 'Reduce the amount to prevent numeric overflow',
    'mismatch': 'Verify account types and program relationships'
  };

  const lowerName = errorName.toLowerCase();
  for (const [key, resolution] of Object.entries(resolutions)) {
    if (lowerName.includes(key)) {
      return resolution;
    }
  }

  return 'Review instruction parameters and account states';
}

function inferProgramId(label: string, accounts?: LegacyAccount[]): string {
  // Try to find program from accounts
  const programAccount = accounts?.find(acc => acc.type.toLowerCase() === 'program');
  if (programAccount) {
    // Return known program IDs based on common patterns
    if (programAccount.label.toLowerCase().includes('token')) {
      return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; // SPL Token Program
    }
    if (programAccount.label.toLowerCase().includes('system')) {
      return '11111111111111111111111111111112'; // System Program
    }
    if (programAccount.label.toLowerCase().includes('associated')) {
      return 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'; // Associated Token Program
    }
  }

  // Infer from instruction name
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('mint') || lowerLabel.includes('token') || lowerLabel.includes('transfer')) {
    return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  }
  if (lowerLabel.includes('system') || lowerLabel.includes('account')) {
    return '11111111111111111111111111111112';
  }
  if (lowerLabel.includes('associated')) {
    return 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  }

  // Default to SPL Token Program
  return 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
}

// Main conversion function
export function convertLegacyToEnhanced(legacyData: LegacyInstructionNodeData): EnhancedInstructionNodeData {
  //console.log('Converting legacy instruction:', legacyData.label);
  
  const category = categorizeInstruction(legacyData.label);
  const programId = inferProgramId(legacyData.label, legacyData.accounts);
  
  const enhancedAccounts = legacyData.accounts?.map(convertAccount) || [];
  const enhancedParameters = legacyData.parameters?.map(convertParameter) || [];
  const enhancedErrorCodes = legacyData.errorCodes?.map(convertErrorCode) || [];
  const enhancedEvents = legacyData.events?.map(convertEvent) || [];
  
  const estimatedCost = estimateCost(category, enhancedAccounts.length);
  /*
  console.log('Enhanced conversion result:', {
    label: legacyData.label,
    category,
    programId,
    accountCount: enhancedAccounts.length,
    parameterCount: enhancedParameters.length,
    errorCount: enhancedErrorCodes.length,
    eventCount: enhancedEvents.length,
    estimatedCost
  });
  */

  return {
    label: legacyData.label,
    description: legacyData.description,
    programId,
    category,
    accounts: enhancedAccounts,
    parameters: enhancedParameters,
    errorCodes: enhancedErrorCodes,
    events: enhancedEvents,
    code: legacyData.code,
    estimatedCost,
    validationStatus: ValidationStatus.PENDING,
    prerequisites: generatePrerequisites(category, enhancedAccounts),
    effects: generateEffects(category, legacyData.label)
  };
}

function generatePrerequisites(category: any, accounts: EnhancedAccount[]): string[] {
  const prerequisites: string[] = [];
  
  // Add common prerequisites
  prerequisites.push('Wallet must be connected');
  
  const hasTokenAccount = accounts.some(acc => acc.type === AccountType.TOKEN_ACCOUNT);
  const hasMint = accounts.some(acc => acc.type === AccountType.MINT);
  const hasWritableAccount = accounts.some(acc => acc.isWritable);
  
  if (hasTokenAccount) {
    prerequisites.push('Token account must be initialized');
  }
  
  if (hasMint) {
    prerequisites.push('Token mint must exist');
  }
  
  if (hasWritableAccount) {
    prerequisites.push('Sufficient SOL for transaction fees');
  }
  
  return prerequisites;
}

function generateEffects(category: any, instructionName: string): string[] {
  const effects: string[] = [];
  
  const lowerName = instructionName.toLowerCase();
  
  if (lowerName.includes('mint')) {
    effects.push('Increases token supply');
    effects.push('Updates token account balance');
  } else if (lowerName.includes('burn')) {
    effects.push('Decreases token supply'); 
    effects.push('Reduces token account balance');
  } else if (lowerName.includes('transfer')) {
    effects.push('Moves tokens between accounts');
    effects.push('Updates account balances');
  } else if (lowerName.includes('approve')) {
    effects.push('Grants spending permission');
    effects.push('Sets delegation amount');
  }
  
  effects.push('Consumes compute units');
  effects.push('Requires transaction fee');
  
  return effects;
}