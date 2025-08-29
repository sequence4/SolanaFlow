import {
  EnhancedInstructionNodeData,
  AccountType,
  ParameterType,
  InstructionCategory,
  ErrorSeverity,
  ValidationStatus
} from '@/types/EnhancedInstructionTypes';

export const enhancedMintTo: EnhancedInstructionNodeData = {
  label: 'Mint To',
  description: 'Mints new tokens to a specified token account. This instruction increases the token supply and credits the destination account.',
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  category: InstructionCategory.MINT,
  accounts: [
    {
      label: 'Token Mint',
      type: AccountType.MINT,
      description: 'The mint account from which new tokens will be created',
      isWritable: true,
      isSigner: false,
      publicKey: 'So11111111111111111111111111111111111111112',
      owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      lamports: '0.00203928',
      rentEpoch: '18446744073709551615'
    },
    {
      label: 'Destination Token Account',
      type: AccountType.TOKEN_ACCOUNT,
      description: 'The token account that will receive the newly minted tokens',
      isWritable: true,
      isSigner: false,
      publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      lamports: '0.00203928',
      rentEpoch: '18446744073709551615'
    },
    {
      label: 'Mint Authority',
      type: AccountType.ACCOUNT_INFO,
      description: 'The account authorized to mint new tokens',
      isWritable: false,
      isSigner: true,
      publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      owner: '11111111111111111111111111111112',
      lamports: '1.00000000',
      rentEpoch: '18446744073709551615'
    },
    {
      label: 'Token Program',
      type: AccountType.PROGRAM,
      description: 'The SPL Token program',
      isWritable: false,
      isSigner: false,
      publicKey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    }
  ],
  parameters: [
    {
      label: 'Amount',
      type: ParameterType.U64,
      value: '1000000',
      placeholder: 'Enter amount to mint (in smallest unit)',
      description: 'The number of tokens to mint, specified in the smallest unit of the token',
      required: true,
      validation: [
        {
          type: 'required',
          message: 'Amount is required'
        },
        {
          type: 'min',
          value: 1,
          message: 'Amount must be greater than 0'
        }
      ]
    }
  ],
  errorCodes: [
    {
      name: 'InsufficientFunds',
      message: 'The account does not have sufficient funds for the operation',
      severity: ErrorSeverity.HIGH,
      code: 1,
      resolution: 'Ensure the mint authority account has sufficient SOL for transaction fees'
    },
    {
      name: 'InvalidMint',
      message: 'The provided mint account is invalid or not owned by the Token Program',
      severity: ErrorSeverity.CRITICAL,
      code: 2,
      resolution: 'Verify the mint account address and ensure it is a valid SPL token mint'
    },
    {
      name: 'InvalidAccount',
      message: 'The destination account is not a valid token account',
      severity: ErrorSeverity.CRITICAL,
      code: 3,
      resolution: 'Ensure the destination is a properly initialized token account'
    },
    {
      name: 'InvalidAuthority',
      message: 'The provided authority does not have permission to mint tokens',
      severity: ErrorSeverity.CRITICAL,
      code: 4,
      resolution: 'Use the correct mint authority account that was set during mint initialization'
    },
    {
      name: 'FixedSupply',
      message: 'Cannot mint tokens as the mint has a fixed supply',
      severity: ErrorSeverity.HIGH,
      code: 5,
      resolution: 'Check if the mint authority has been set to null, preventing further minting'
    }
  ],
  events: [
    {
      name: 'TokenMinted',
      description: 'Emitted when tokens are successfully minted',
      fields: [
        { name: 'mint', type: 'Pubkey', description: 'The mint account address' },
        { name: 'account', type: 'Pubkey', description: 'The destination token account' },
        { name: 'amount', type: 'u64', description: 'Amount of tokens minted' },
        { name: 'authority', type: 'Pubkey', description: 'The mint authority that signed' }
      ],
      emissionCondition: 'When minting operation completes successfully'
    }
  ],
  estimatedCost: {
    computeUnits: 3800,
    lamports: 19,
    description: 'Estimated cost based on mint instruction with 4 accounts'
  },
  prerequisites: [
    'Wallet must be connected',
    'Token mint must exist and be properly initialized',
    'Destination token account must be initialized',
    'Mint authority must have signing permissions',
    'Sufficient SOL for transaction fees'
  ],
  effects: [
    'Increases total token supply',
    'Credits destination account balance',
    'Updates mint account supply counter',
    'Consumes compute units',
    'Requires transaction fee payment'
  ],
  validationStatus: ValidationStatus.VALID
};