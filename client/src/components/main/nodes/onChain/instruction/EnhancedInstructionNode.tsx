import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

import {
  EnhancedInstructionNodeData,
  EnhancedAccount,
  EnhancedParameter,
  CATEGORY_COLORS,
  ACCOUNT_TYPE_ICONS
} from '@/types/EnhancedInstructionTypes';

import '@/styles/enhanced-instruction-node.css';

// Account type to emoji mapping
const ACCOUNT_TYPE_EMOJIS = {
  'AccountInfo': '📝',
  'Program': '⚙️',
  'Sysvar': '🔧',
  'TokenAccount': '💰',
  'Mint': '🔑',
  'AssociatedTokenAccount': '🔗',
  'Multisig': '👥',
  'Unknown': '❓'
};

// Account Card Component - Professional Design
const AccountCard: React.FC<{ account: EnhancedAccount; index: number }> = ({ account, index }) => {
  const getAccountFlags = () => {
    const flags = [];
    if (account?.isSigner) flags.push({ label: 'Signer', class: 'signer' });
    if (account?.isWritable) flags.push({ label: 'Writable', class: 'writable' });
    if (account?.label?.toLowerCase().includes('payer')) flags.push({ label: 'Payer', class: 'payer' });
    return flags;
  };

  const truncateAddress = (address: string) => {
    if (!address || address.length <= 12) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="account-item">
      <div className="account-info">
        <div className="account-details">
          <div className="account-name">{account?.label || 'Unknown Account'}</div>
          <div className="account-address">
            {truncateAddress(account?.publicKey || 'Click to configure')}
          </div>
        </div>
      </div>
      <div className="account-flags">
        {getAccountFlags().map((flag, idx) => (
          <span key={idx} className={`flag ${flag.class}`}>
            {flag.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Data Field Component matching the new design
const DataField: React.FC<{ parameter: EnhancedParameter; index: number }> = ({ parameter, index }) => {
  const [value, setValue] = useState(parameter?.value || '');
  
  const getPlaceholder = () => {
    if (parameter?.placeholder) return parameter.placeholder;
    if (parameter?.type?.toLowerCase().includes('option')) return `Optional: ${parameter.label}`;
    if (parameter?.type === 'u8') return 'Enter number (0-255)';
    if (parameter?.type === 'u64') return 'Enter large number';
    if (parameter?.type?.toLowerCase().includes('pubkey')) return 'Enter public key';
    return `Enter ${parameter?.label?.toLowerCase() || 'value'}`;
  };

  return (
    <div className="data-field">
      <div className="data-field-header">
        <span className="data-field-name">{parameter?.label || 'Parameter'}</span>
        <span className="data-field-type">{parameter?.type || 'unknown'}</span>
      </div>
      <input
        type="text"
        className="data-field-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={getPlaceholder()}
      />
    </div>
  );
};

// Main Enhanced Instruction Node Component
export const EnhancedInstructionNode: React.FC<{ data: EnhancedInstructionNodeData }> = ({ data }) => {
  // Handle cases where data might be missing - MUST BE DEFINED FIRST
  const safeData = {
    ...data,
    programId: data.programId || 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    category: data.category || 'other',
    validationStatus: data.validationStatus || 'valid'
  };

  const accounts = data.accounts || [];
  const parameters = data.parameters || [];
  
  // Get the instruction icon based on name
  const getInstructionIcon = () => {
    const name = safeData.label?.toLowerCase() || '';
    if (name.includes('mint')) return 'M';
    if (name.includes('transfer')) return 'T';
    if (name.includes('burn')) return 'B';
    if (name.includes('approve')) return 'A';
    if (name.includes('initialize') || name.includes('init')) return 'I';
    if (name.includes('create')) return 'C';
    if (name.includes('close')) return 'X';
    return safeData.label?.charAt(0).toUpperCase() || 'N';
  };

  const getValidationStatus = () => {
    switch (safeData.validationStatus) {
      case 'valid': return '✓ Valid';
      case 'warning': return '⚠ Warning';
      case 'error': return '✗ Error';
      case 'pending': return '⏳ Validating';
      default: return '✓ Valid';
    }
  };

  const truncateProgramId = (programId: string) => {
    if (!programId || programId.length <= 16) return programId;
    return programId;
  };

  // Generate description based on instruction type
  const getDescription = () => {
    if (safeData.description) return safeData.description;
    
    const name = safeData.label?.toLowerCase() || '';
    if (name.includes('initialize') && name.includes('mint')) {
      return 'Creates and initializes a new SPL token mint account with the specified decimals and authorities. This instruction must be called before any tokens can be minted.';
    }
    if (name.includes('mint')) {
      return 'Mints new tokens to the specified destination account. Requires mint authority signature.';
    }
    if (name.includes('transfer')) {
      return 'Transfers tokens from source account to destination account. Requires owner or delegate signature.';
    }
    if (name.includes('approve')) {
      return 'Approves a delegate to spend tokens from the source account up to the specified amount.';
    }
    if (name.includes('burn')) {
      return 'Burns tokens from the specified account, reducing the total supply. Requires owner or delegate signature.';
    }
    return `Executes ${safeData.label} instruction on the Solana blockchain.`;
  };

  return (
    <div className="instruction-node">
      {/* Header */}
      <div className="node-header">
        <div className="node-title">
          <div className="node-icon">{getInstructionIcon()}</div>
          <span className="node-name">{safeData.label}</span>
        </div>
        <div className="node-status">
          <div className="status-indicator"></div>
        </div>
      </div>

      {/* Program Info */}
      <div className="program-info">
        <div className="program-label">Program ID</div>
        <div className="program-id">{truncateProgramId(safeData.programId)}</div>
      </div>

      {/* Node Body */}
      <div className="node-body">
        {/* Accounts Section */}
        {accounts.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                📝 Accounts
                <span className="badge">{accounts.length}</span>
              </div>
            </div>
            
            {accounts.map((account, index) => (
              <AccountCard key={index} account={account} index={index} />
            ))}
          </div>
        )}

        {/* Instruction Data Section */}
        {parameters.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                ⚡ Instruction Data
                <span className="badge">{parameters.length}</span>
              </div>
            </div>
            
            {parameters.map((parameter, index) => (
              <DataField key={index} parameter={parameter} index={index} />
            ))}
          </div>
        )}

        {/* Description */}
        <div className="description">
          {getDescription()}
        </div>
      </div>

      {/* React Flow Handles */}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
};