import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronRight, Copy, Check } from 'lucide-react';

import {
  EnhancedInstructionNodeData,
  EnhancedAccount,
  EnhancedParameter
} from '@/types/EnhancedInstructionTypes';

// Import modern styles
import '@/styles/modern-instruction-node.css';

// Toast notification component
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="modern-toast">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Check size={16} />
        {message}
      </div>
    </div>
  );
};

// Account Card Component - Modern Clean Design
const AccountCard: React.FC<{ account: EnhancedAccount; index: number }> = ({ account, index }) => {
  const [showToast, setShowToast] = useState(false);
  
  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (account?.publicKey) {
      navigator.clipboard.writeText(account.publicKey);
      setShowToast(true);
    }
  };

  const truncateAddress = (address?: string) => {
    if (!address || address.length <= 16) return address || 'Click to configure';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getAccountTypeClass = () => {
    const type = account?.type?.toLowerCase() || '';
    if (type.includes('mint')) return 'mint';
    if (type.includes('authority')) return 'authority';  
    if (type.includes('program') || type.includes('sysvar')) return 'system';
    return '';
  };

  const getCombinedFlags = () => {
    const flags = [];
    if (account?.isSigner) flags.push('S');
    if (account?.isWritable) flags.push('W');
    if (account?.label?.toLowerCase().includes('payer')) flags.push('P');
    return flags.join('');
  };

  const combinedFlags = getCombinedFlags();

  return (
    <>
      <div className={`modern-account-item ${getAccountTypeClass()}`}>
        <div className="modern-account-info">
          <div className="modern-account-name">
            {account?.label || 'Unknown Account'}
          </div>
          <div className="modern-account-address">
            {truncateAddress(account?.publicKey)}
            <button 
              className="modern-copy-button"
              onClick={handleCopyAddress}
              aria-label="Copy address"
              title="Copy address to clipboard"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
        
        {combinedFlags && (
          <div className="modern-account-flags">
            <span className="modern-flag combined" title={
              combinedFlags.includes('S') ? 'Signer ' : '' +
              combinedFlags.includes('W') ? 'Writable ' : '' +
              combinedFlags.includes('P') ? 'Payer' : ''
            }>
              {combinedFlags}
            </span>
          </div>
        )}
      </div>
      
      {showToast && (
        <Toast 
          message="Address copied to clipboard" 
          onClose={() => setShowToast(false)} 
        />
      )}
    </>
  );
};

// Data Field Component - Modern Design
const DataField: React.FC<{ parameter: EnhancedParameter; index: number }> = ({ parameter, index }) => {
  const [value, setValue] = useState(parameter?.value || '');
  const [isFocused, setIsFocused] = useState(false);
  
  const getPlaceholder = () => {
    if (parameter?.placeholder) return parameter.placeholder;
    if (parameter?.type?.toLowerCase().includes('option')) return `Optional: ${parameter.label}`;
    if (parameter?.type === 'u8') return 'Enter number (0-255)';
    if (parameter?.type === 'u64') return 'Enter large number';
    if (parameter?.type?.toLowerCase().includes('pubkey')) return 'Enter public key';
    return `Enter ${parameter?.label?.toLowerCase() || 'value'}`;
  };

  return (
    <div className="modern-data-field">
      <div className="modern-data-field-header">
        <span className="modern-data-field-name">
          {parameter?.label || 'Parameter'}
        </span>
        <span className="modern-data-field-type">
          {parameter?.type || 'unknown'}
        </span>
      </div>
      <input
        type="text"
        className="modern-data-field-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={getPlaceholder()}
        aria-label={`Input for ${parameter?.label}`}
      />
    </div>
  );
};

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = false, children }) => {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  
  return (
    <div className="modern-section">
      <div 
        className="modern-collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <ChevronRight 
          size={12} 
          className={`modern-chevron ${isExpanded ? 'expanded' : ''}`} 
        />
        <span className="modern-section-title">{title}</span>
        {count !== undefined && (
          <span className="modern-badge">{count}</span>
        )}
      </div>
      <div className={`modern-collapsible-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        {children}
      </div>
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
    <div className="modern-instruction-node">
      {/* Header with instruction name */}
      <div className="modern-node-header">
        <div className="modern-node-title">
          <div className="modern-node-icon" aria-label="Instruction icon">
            {getInstructionIcon()}
          </div>
          <span className="modern-node-name">{safeData.label}</span>
          <div className="modern-program-id" title={safeData.programId}>
            {truncateProgramId(safeData.programId)}
          </div>
        </div>
      </div>

      {/* Body with all sections in single scrollable view */}
      <div className="modern-node-body">
        {/* Description (if provided) */}
        <div className="modern-section">
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: 'rgba(59, 130, 246, 0.02)',
            border: '1px solid rgba(59, 130, 246, 0.1)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '1.4',
            color: 'var(--text-secondary)',
            marginBottom: '16px'
          }}>
            {getDescription()}
          </div>
        </div>

        {/* Accounts Section */}
        {accounts.length > 0 && (
          <CollapsibleSection 
            title="Accounts" 
            count={accounts.length}
            defaultOpen={false}
          >
            {accounts.map((account, index) => (
              <AccountCard key={index} account={account} index={index} />
            ))}
          </CollapsibleSection>
        )}

        {/* Instruction Data Section */}
        {parameters.length > 0 && (
          <CollapsibleSection 
            title="Instruction Data" 
            count={parameters.length}
            defaultOpen={false}
          >
            {parameters.map((parameter, index) => (
              <DataField key={index} parameter={parameter} index={index} />
            ))}
          </CollapsibleSection>
        )}

        {/* Empty state when no accounts or parameters */}
        {accounts.length === 0 && parameters.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: 'var(--text-secondary)',
            fontSize: '12px'
          }}>
            No accounts or parameters configured
          </div>
        )}
      </div>

      {/* React Flow Handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ visibility: 'hidden' }} 
        aria-label="Connection input"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ visibility: 'hidden' }} 
        aria-label="Connection output"
      />
    </div>
  );
};