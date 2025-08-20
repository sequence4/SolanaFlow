import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronRight, Copy, Check } from 'lucide-react';

// Styles
import '@/styles/modern-instruction-node.css';

// Types
import {
  EnhancedInstructionNodeData,
  EnhancedAccount,
  EnhancedParameter
} from '@/types/EnhancedInstructionTypes';

// Legacy types for backward compatibility
interface Account {
  label: string;
  type: string;
  description?: string;
  info?: any;
  isWritable?: boolean;
  isSigner?: boolean;
  publicKey?: string;
}

interface Parameter {
  label: string;
  type: string;
  value?: string;
}

interface InstructionGroupNodeData {
  label: string;
  description?: string;
  accounts?: Account[];
  parameters?: Parameter[];
  errorCodes?: any[];
  events?: any[];
  code?: string;
}

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

// Account item component with modern design
const AccountItem: React.FC<{ 
  account: EnhancedAccount | Account; 
  index: number 
}> = ({ account, index }) => {
  const [showToast, setShowToast] = useState(false);
  
  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = 'publicKey' in account ? account.publicKey : '11111111111111111111111111111111';
    if (address) {
      navigator.clipboard.writeText(address);
      setShowToast(true);
    }
  };

  const truncateAddress = (address?: string) => {
    if (!address || address.length <= 16) return address || 'Click to configure';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getAccountTypeClass = () => {
    const type = account.type?.toLowerCase() || '';
    if (type.includes('mint')) return 'mint';
    if (type.includes('authority')) return 'authority';  
    if (type.includes('program') || type.includes('sysvar')) return 'system';
    return '';
  };

  const getCombinedFlags = () => {
    const flags = [];
    if (account.isSigner) flags.push('S');
    if (account.isWritable) flags.push('W');
    if (account.label?.toLowerCase().includes('payer')) flags.push('P');
    return flags.join('');
  };

  const combinedFlags = getCombinedFlags();

  return (
    <>
      <div className={`modern-account-item ${getAccountTypeClass()}`}>
        <div className="modern-account-info">
          <div className="modern-account-name">
            {account.label || 'Unknown Account'}
          </div>
          <div className="modern-account-address">
            {truncateAddress('publicKey' in account ? account.publicKey : undefined)}
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

// Data field component with inline editing
const DataField: React.FC<{ 
  parameter: EnhancedParameter | Parameter; 
  index: number 
}> = ({ parameter, index }) => {
  const [value, setValue] = useState(parameter.value || '');
  const [isFocused, setIsFocused] = useState(false);
  
  const getPlaceholder = () => {
    if ('placeholder' in parameter && parameter.placeholder) {
      return parameter.placeholder;
    }
    
    const type = parameter.type?.toLowerCase() || '';
    if (type.includes('option')) return `Optional: ${parameter.label}`;
    if (type === 'u8') return 'Enter number (0-255)';
    if (type === 'u64') return 'Enter large number';
    if (type.includes('pubkey')) return 'Enter public key';
    return `Enter ${parameter.label?.toLowerCase() || 'value'}`;
  };

  return (
    <div className="modern-data-field">
      <div className="modern-data-field-header">
        <span className="modern-data-field-name">
          {parameter.label || 'Parameter'}
        </span>
        <span className="modern-data-field-type">
          {parameter.type || 'unknown'}
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
        aria-label={`Input for ${parameter.label}`}
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

// Main Modern Instruction Node Component
export const ModernInstructionNode: React.FC<{ 
  data: EnhancedInstructionNodeData | InstructionGroupNodeData 
}> = ({ data }) => {
  // Safely handle both data formats
  const safeData = {
    label: data.label || 'Unknown Instruction',
    programId: 'programId' in data ? data.programId : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    description: data.description,
    accounts: data.accounts || [],
    parameters: data.parameters || [],
    validationStatus: 'validationStatus' in data ? data.validationStatus : 'valid'
  };

  // Get instruction icon based on name
  const getInstructionIcon = () => {
    const name = safeData.label.toLowerCase();
    if (name.includes('mint')) return 'M';
    if (name.includes('transfer')) return 'T';
    if (name.includes('burn')) return 'B';
    if (name.includes('approve')) return 'A';
    if (name.includes('initialize') || name.includes('init')) return 'I';
    if (name.includes('create')) return 'C';
    if (name.includes('close')) return 'X';
    return safeData.label.charAt(0).toUpperCase() || 'N';
  };

  // Get status dot class based on validation
  const getStatusClass = () => {
    switch (safeData.validationStatus) {
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return '';
    }
  };

  // Truncate program ID for display
  const truncateProgramId = (programId: string) => {
    if (programId.length <= 16) return programId;
    return `${programId.slice(0, 8)}...${programId.slice(-8)}`;
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
        {safeData.description && (
          <div className="modern-section">
            <div className="modern-section-header">
              <span className="modern-section-title">Description</span>
            </div>
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: 'rgba(59, 130, 246, 0.02)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.4',
              color: 'var(--text-secondary)'
            }}>
              {safeData.description}
            </div>
          </div>
        )}

        {/* Accounts Section */}
        {safeData.accounts.length > 0 && (
          <CollapsibleSection 
            title="Accounts" 
            count={safeData.accounts.length}
            defaultOpen={false}
          >
            {safeData.accounts.map((account, index) => (
              <AccountItem key={index} account={account} index={index} />
            ))}
          </CollapsibleSection>
        )}

        {/* Instruction Data Section */}
        {safeData.parameters.length > 0 && (
          <CollapsibleSection 
            title="Instruction Data" 
            count={safeData.parameters.length}
            defaultOpen={false}
          >
            {safeData.parameters.map((parameter, index) => (
              <DataField key={index} parameter={parameter} index={index} />
            ))}
          </CollapsibleSection>
        )}

        {/* Empty state when no accounts or parameters */}
        {safeData.accounts.length === 0 && safeData.parameters.length === 0 && (
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