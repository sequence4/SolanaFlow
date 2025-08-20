import React from 'react';
import { ModernInstructionNode } from '@/components/main/nodes/onChain/instruction/ModernInstructionNode';
import { EnhancedInstructionNodeData, InstructionCategory, AccountType, ParameterType, ValidationStatus } from '@/types/EnhancedInstructionTypes';

// Sample test data for the modern node
const testData: EnhancedInstructionNodeData = {
  label: 'Initialize Mint',
  description: 'Creates and initializes a new SPL token mint account with the specified decimals and authorities.',
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  category: InstructionCategory.INITIALIZE,
  validationStatus: ValidationStatus.VALID,
  accounts: [
    {
      label: 'Mint Account',
      type: AccountType.MINT,
      publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      description: 'The mint account to initialize',
      isWritable: true,
      isSigner: false,
    },
    {
      label: 'Mint Authority',
      type: AccountType.ACCOUNT_INFO,
      publicKey: 'AuthorityAccountForMintOperations123456789',
      description: 'Authority account for mint operations',
      isWritable: false,
      isSigner: true,
    },
  ],
  parameters: [
    {
      label: 'Decimals',
      type: ParameterType.U8,
      value: '9',
      description: 'Number of decimal places for the token',
      required: true,
    },
    {
      label: 'Mint Authority',
      type: ParameterType.PUBKEY,
      value: '',
      placeholder: 'Enter mint authority public key',
      description: 'Public key of the mint authority',
      required: true,
    },
  ],
};

const ModernInstructionNodeTest: React.FC = () => {
  return (
    <div style={{ 
      padding: '40px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <ModernInstructionNode data={testData} />
    </div>
  );
};

export default ModernInstructionNodeTest;