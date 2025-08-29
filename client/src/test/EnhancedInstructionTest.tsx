import React from 'react';
import { EnhancedInstructionNode } from '@/components/main/nodes/onChain/instruction/EnhancedInstructionNode';
import { enhancedMintTo } from '@/data/nodes/onChain/instructions/spl-token-program/mintTo/enhancedMintTo';
import { convertLegacyToEnhanced } from '@/utils/enhancedNodeConverter';

// Test component to verify enhanced node rendering
export const EnhancedInstructionTest: React.FC = () => {
  // Test with enhanced data
  const renderEnhancedNode = () => {
    return (
      <div style={{ padding: '20px', background: '#1a1a24' }}>
        <h2 style={{ color: 'white', marginBottom: '20px' }}>Enhanced Mint To Node</h2>
        <EnhancedInstructionNode data={enhancedMintTo} />
      </div>
    );
  };

  // Test with legacy data conversion
  const legacyData = {
    label: 'Transfer',
    description: 'Transfer tokens between accounts',
    accounts: [
      { 
        label: 'Source Account', 
        type: 'TokenAccount', 
        description: 'The source token account',
        isWritable: true
      },
      { 
        label: 'Destination Account', 
        type: 'TokenAccount', 
        description: 'The destination token account',
        isWritable: true 
      },
      { 
        label: 'Authority', 
        type: 'Signer', 
        description: 'The account authority'
      },
      { 
        label: 'Token Program', 
        type: 'Program', 
        description: 'The SPL Token program'
      }
    ],
    parameters: [
      { 
        label: 'Amount', 
        type: 'u64', 
        value: '1000000' 
      }
    ],
    errorCodes: [
      { 
        name: 'InsufficientFunds', 
        message: 'The account does not have sufficient balance' 
      },
      { 
        name: 'InvalidAccount', 
        message: 'The account is not valid for this operation' 
      }
    ]
  };

  const convertedData = convertLegacyToEnhanced(legacyData);

  const renderConvertedNode = () => {
    return (
      <div style={{ padding: '20px', background: '#1a1a24', marginTop: '20px' }}>
        <h2 style={{ color: 'white', marginBottom: '20px' }}>Converted Legacy Transfer Node</h2>
        <EnhancedInstructionNode data={convertedData} />
      </div>
    );
  };

  return (
    <div style={{ background: '#121218', minHeight: '100vh' }}>
      {renderEnhancedNode()}
      {renderConvertedNode()}
    </div>
  );
};