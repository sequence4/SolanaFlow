export interface EnhancedAccount {
  label: string;
  type: AccountType;
  publicKey?: string;
  description?: string;
  isWritable?: boolean;
  isSigner?: boolean;
  isOptional?: boolean;
  owner?: string;
  lamports?: string;
  rentEpoch?: string;
}

export interface EnhancedParameter {
  label: string;
  type: ParameterType;
  value?: string;
  placeholder?: string;
  validation?: ValidationRule[];
  description?: string;
  required?: boolean;
}

export interface EnhancedErrorCode {
  name: string;
  message: string;
  severity: ErrorSeverity;
  code?: number;
  resolution?: string;
}

export interface EnhancedEvent {
  name: string;
  type?: string;
  description: string;
  fields?: EventField[];
  emissionCondition?: string;
}

export interface EventField {
  name: string;
  type: string;
  description?: string;
}

export interface EnhancedInstructionNodeData {
  label: string;
  description?: string;
  programId: string;
  category: InstructionCategory;
  accounts?: EnhancedAccount[];
  parameters?: EnhancedParameter[];
  errorCodes?: EnhancedErrorCode[];
  events?: EnhancedEvent[];
  code?: string;
  estimatedCost?: CostEstimate;
  prerequisites?: string[];
  effects?: string[];
  validationStatus?: ValidationStatus;
}

// Enums and Type Definitions
export enum AccountType {
  ACCOUNT_INFO = 'AccountInfo',
  PROGRAM = 'Program', 
  SYSVAR = 'Sysvar',
  TOKEN_ACCOUNT = 'TokenAccount',
  MINT = 'Mint',
  ASSOCIATED_TOKEN_ACCOUNT = 'AssociatedTokenAccount',
  MULTISIG = 'Multisig',
  UNKNOWN = 'Unknown'
}

export enum ParameterType {
  U8 = 'u8',
  U16 = 'u16', 
  U32 = 'u32',
  U64 = 'u64',
  U128 = 'u128',
  I8 = 'i8',
  I16 = 'i16',
  I32 = 'i32', 
  I64 = 'i64',
  I128 = 'i128',
  BOOL = 'bool',
  STRING = 'string',
  PUBKEY = 'Pubkey',
  BYTES = 'bytes',
  OPTIONAL = 'Option',
  VEC = 'Vec'
}

export enum InstructionCategory {
  TRANSFER = 'transfer',
  MINT = 'mint',
  BURN = 'burn',
  APPROVE = 'approve',
  REVOKE = 'revoke',
  INITIALIZE = 'initialize',
  CLOSE = 'close',
  FREEZE = 'freeze',
  THAW = 'thaw',
  SYNC = 'sync',
  OTHER = 'other'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ValidationStatus {
  VALID = 'valid',
  WARNING = 'warning',
  ERROR = 'error',
  PENDING = 'pending'
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface CostEstimate {
  computeUnits: number;
  lamports: number;
  rentExemption?: number;
  description: string;
}

// Color mappings for categories
export const CATEGORY_COLORS = {
  [InstructionCategory.TRANSFER]: {
    primary: '#36b37e',
    secondary: 'rgba(54, 179, 126, 0.1)',
    border: 'rgba(54, 179, 126, 0.3)'
  },
  [InstructionCategory.MINT]: {
    primary: '#5d5dff',
    secondary: 'rgba(93, 93, 255, 0.1)', 
    border: 'rgba(93, 93, 255, 0.3)'
  },
  [InstructionCategory.BURN]: {
    primary: '#e53e3e',
    secondary: 'rgba(229, 62, 62, 0.1)',
    border: 'rgba(229, 62, 62, 0.3)'
  },
  [InstructionCategory.APPROVE]: {
    primary: '#d69e2e',
    secondary: 'rgba(214, 158, 46, 0.1)',
    border: 'rgba(214, 158, 46, 0.3)'
  },
  [InstructionCategory.REVOKE]: {
    primary: '#9945ff',
    secondary: 'rgba(153, 69, 255, 0.1)',
    border: 'rgba(153, 69, 255, 0.3)'
  },
  [InstructionCategory.INITIALIZE]: {
    primary: '#1cf6a0',
    secondary: 'rgba(28, 246, 160, 0.1)', 
    border: 'rgba(28, 246, 160, 0.3)'
  },
  [InstructionCategory.CLOSE]: {
    primary: '#ff6b6b',
    secondary: 'rgba(255, 107, 107, 0.1)',
    border: 'rgba(255, 107, 107, 0.3)'
  },
  [InstructionCategory.FREEZE]: {
    primary: '#4dabf7',
    secondary: 'rgba(77, 171, 247, 0.1)',
    border: 'rgba(77, 171, 247, 0.3)'
  },
  [InstructionCategory.THAW]: {
    primary: '#ff8cc8',
    secondary: 'rgba(255, 140, 200, 0.1)',
    border: 'rgba(255, 140, 200, 0.3)'
  },
  [InstructionCategory.SYNC]: {
    primary: '#40c057',
    secondary: 'rgba(64, 192, 87, 0.1)',
    border: 'rgba(64, 192, 87, 0.3)'
  },
  [InstructionCategory.OTHER]: {
    primary: '#868e96',
    secondary: 'rgba(134, 142, 150, 0.1)',
    border: 'rgba(134, 142, 150, 0.3)'
  }
};

// Account type icons mapping
export const ACCOUNT_TYPE_ICONS = {
  [AccountType.ACCOUNT_INFO]: 'Database',
  [AccountType.PROGRAM]: 'Code',
  [AccountType.SYSVAR]: 'Settings',
  [AccountType.TOKEN_ACCOUNT]: 'Coins',
  [AccountType.MINT]: 'Factory', 
  [AccountType.ASSOCIATED_TOKEN_ACCOUNT]: 'Link',
  [AccountType.MULTISIG]: 'Users',
  [AccountType.UNKNOWN]: 'HelpCircle'
};

// Parameter type placeholders
export const PARAMETER_PLACEHOLDERS = {
  [ParameterType.U8]: 'Enter value (0-255)',
  [ParameterType.U16]: 'Enter value (0-65535)',
  [ParameterType.U32]: 'Enter value (0-4294967295)', 
  [ParameterType.U64]: 'Enter value (0-18446744073709551615)',
  [ParameterType.U128]: 'Enter large integer value',
  [ParameterType.I8]: 'Enter value (-128 to 127)',
  [ParameterType.I16]: 'Enter value (-32768 to 32767)',
  [ParameterType.I32]: 'Enter value (-2147483648 to 2147483647)',
  [ParameterType.I64]: 'Enter signed integer',
  [ParameterType.I128]: 'Enter large signed integer',
  [ParameterType.BOOL]: 'true or false',
  [ParameterType.STRING]: 'Enter text string',
  [ParameterType.PUBKEY]: 'Enter 44-character base58 public key',
  [ParameterType.BYTES]: 'Enter hex-encoded bytes',
  [ParameterType.OPTIONAL]: 'Enter optional value or leave empty',
  [ParameterType.VEC]: 'Enter comma-separated list'
};

// Utility functions
export function categorizeInstruction(instructionName: string): InstructionCategory {
  const name = instructionName.toLowerCase();
  
  if (name.includes('transfer') || name.includes('send')) return InstructionCategory.TRANSFER;
  if (name.includes('mint')) return InstructionCategory.MINT;
  if (name.includes('burn')) return InstructionCategory.BURN;
  if (name.includes('approve')) return InstructionCategory.APPROVE;
  if (name.includes('revoke')) return InstructionCategory.REVOKE;
  if (name.includes('init')) return InstructionCategory.INITIALIZE;
  if (name.includes('close')) return InstructionCategory.CLOSE;
  if (name.includes('freeze')) return InstructionCategory.FREEZE;
  if (name.includes('thaw')) return InstructionCategory.THAW;
  if (name.includes('sync')) return InstructionCategory.SYNC;
  
  return InstructionCategory.OTHER;
}

export function estimateCost(category: InstructionCategory, accountCount: number): CostEstimate {
  const baseComputeUnits = {
    [InstructionCategory.TRANSFER]: 2000,
    [InstructionCategory.MINT]: 3000,
    [InstructionCategory.BURN]: 2500,
    [InstructionCategory.APPROVE]: 1500,
    [InstructionCategory.REVOKE]: 1200,
    [InstructionCategory.INITIALIZE]: 5000,
    [InstructionCategory.CLOSE]: 1800,
    [InstructionCategory.FREEZE]: 1600,
    [InstructionCategory.THAW]: 1600,
    [InstructionCategory.SYNC]: 2200,
    [InstructionCategory.OTHER]: 2000
  };

  const computeUnits = baseComputeUnits[category] + (accountCount * 200);
  const lamports = Math.ceil(computeUnits / 1000) * 5; // Approximate lamport cost

  return {
    computeUnits,
    lamports,
    description: `Estimated cost based on ${category} instruction with ${accountCount} accounts`
  };
}