import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  ChevronRight, 
  Copy, 
  Edit2, 
  Database,
  Code,
  Settings,
  Coins,
  Factory,
  Link,
  Users,
  HelpCircle,
  AlertCircle,
  Zap,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock
} from 'lucide-react';

import {
  EnhancedInstructionNodeData,
  EnhancedAccount,
  EnhancedParameter,
  EnhancedErrorCode,
  EnhancedEvent,
  AccountType,
  CATEGORY_COLORS,
  ACCOUNT_TYPE_ICONS,
  PARAMETER_PLACEHOLDERS,
  ValidationStatus,
  ErrorSeverity
} from '@/types/EnhancedInstructionTypes';

import '@/styles/enhanced-instruction-node.css';

// Icon mapping
const ICON_MAP = {
  Database,
  Code, 
  Settings,
  Coins,
  Factory,
  Link,
  Users,
  HelpCircle
};

// Account Card Component
const AccountCard: React.FC<{ account: EnhancedAccount }> = ({ account }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [publicKey, setPublicKey] = useState(account?.publicKey || '11111111111111111111111111111111');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicKey);
  };

  const IconComponent = ICON_MAP[ACCOUNT_TYPE_ICONS[account?.type] as keyof typeof ICON_MAP] || HelpCircle;

  const truncatedKey = publicKey.length > 20 
    ? `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`
    : publicKey;

  return (
    <div className="account-card fade-in">
      <div className="account-header">
        <div className="account-title">
          <IconComponent className="account-icon" />
          <span>{account?.label || 'Unknown Account'}</span>
        </div>
        <div className="account-badges">
          {account?.isWritable && (
            <span className="account-badge badge-writable">Writable</span>
          )}
          {account?.isSigner && (
            <span className="account-badge badge-signer">Signer</span>
          )}
          {account?.type === AccountType.PROGRAM && (
            <span className="account-badge badge-program">Program</span>
          )}
        </div>
      </div>
      
      {account?.description && (
        <div className="text-sm text-gray-400 mb-3">
          {account.description}
        </div>
      )}

      <div className="address-field">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className="w-full bg-transparent border-none outline-none text-white font-mono text-sm"
          />
        ) : (
          <>
            <span className="font-mono text-sm">{truncatedKey}</span>
            <div className="address-controls">
              <button onClick={handleCopy} className="control-button" title="Copy address">
                <Copy className="control-icon" />
              </button>
              <button onClick={() => setIsEditing(true)} className="control-button" title="Edit address">
                <Edit2 className="control-icon" />
              </button>
            </div>
          </>
        )}
      </div>

      {account?.owner && (
        <div className="mt-2 text-xs text-gray-500">
          Owner: {account.owner.slice(0, 8)}...{account.owner.slice(-8)}
        </div>
      )}
    </div>
  );
};

// Parameter Field Component
const ParameterField: React.FC<{ parameter: EnhancedParameter }> = ({ parameter }) => {
  const [value, setValue] = useState(parameter?.value || '');
  const placeholder = PARAMETER_PLACEHOLDERS[parameter?.type] || 'Enter value';

  return (
    <div className="parameter-field fade-in">
      <div className="parameter-header">
        <span className="parameter-title">{parameter?.label || 'Unknown Parameter'}</span>
        <span className="parameter-type">{parameter?.type || 'unknown'}</span>
      </div>
      
      {parameter?.description && (
        <div className="text-sm text-gray-400 mb-2">
          {parameter.description}
        </div>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="parameter-input"
        required={parameter?.required}
      />
    </div>
  );
};

// Error Item Component
const ErrorItem: React.FC<{ error: EnhancedErrorCode }> = ({ error }) => {
  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'high': return 'severity-high'; 
      case 'medium': return 'severity-medium';
      case 'low': return 'severity-low';
      default: return 'severity-medium';
    }
  };

  return (
    <div className="error-item fade-in">
      <div className="error-header">
        <AlertCircle className="error-icon" />
        <span className="error-title">{error?.name || 'Unknown Error'}</span>
        <span className={`error-severity ${getSeverityClass(error?.severity || 'medium')}`}>
          {error?.severity || 'medium'}
        </span>
      </div>
      <div className="error-message">{error?.message || 'No error message provided'}</div>
      {error?.resolution && (
        <div className="text-xs text-blue-400 mt-2">
          Resolution: {error.resolution}
        </div>
      )}
    </div>
  );
};

// Event Item Component  
const EventItem: React.FC<{ event: EnhancedEvent }> = ({ event }) => {
  return (
    <div className="event-item fade-in">
      <div className="event-header">
        <Zap className="event-icon" />
        <span className="event-title">{event?.name || 'Unknown Event'}</span>
      </div>
      <div className="event-description">{event?.description || 'No description available'}</div>
      {event?.fields && event.fields.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-gray-500 mb-1">Fields:</div>
          {event.fields.map((field, idx) => (
            <div key={idx} className="text-xs text-gray-400">
              <span className="font-mono text-blue-400">{field?.name || `field_${idx}`}</span>: {field?.type || 'unknown'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  accentColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, count, accentColor, isExpanded, onToggle, children }) => {
  return (
    <div className="enhanced-section">
      <div 
        className="section-header"
        onClick={onToggle}
        style={{ '--section-accent-color': accentColor } as React.CSSProperties}
      >
        <div className="section-icon">{icon}</div>
        <span className="section-title">{title}</span>
        <span className="section-count">{count}</span>
        <ChevronRight className={`chevron-icon ${isExpanded ? 'section-expanded' : ''}`} />
      </div>
      <div className={`section-content ${isExpanded ? 'section-expanded' : ''}`}>
        {children}
      </div>
    </div>
  );
};

// Main Enhanced Instruction Node Component
export const EnhancedInstructionNode: React.FC<{ data: EnhancedInstructionNodeData }> = ({ data }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['accounts']));
  
  // Handle cases where data might be missing - MUST BE DEFINED FIRST
  const safeData = {
    ...data,
    programId: data.programId || 'Unknown Program',
    category: data.category || 'other',
    validationStatus: data.validationStatus || 'pending'
  };

  const accounts = data.accounts || [];
  const parameters = data.parameters || [];
  const errorCodes = data.errorCodes || [];
  const events = data.events || [];
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const categoryColors = CATEGORY_COLORS[safeData.category] || CATEGORY_COLORS.other;
  
  const getStatusIcon = () => {
    switch (safeData.validationStatus) {
      case 'valid': return <CheckCircle className="status-indicator valid" />;
      case 'warning': return <AlertTriangle className="status-indicator warning" />;
      case 'error': return <XCircle className="status-indicator error" />;
      case 'pending': return <Clock className="status-indicator pending" />;
      default: return <Clock className="status-indicator pending" />;
    }
  };

  return (
    <div 
      className="enhanced-instruction-node"
      style={{
        width: '480px',
        minHeight: '400px',
        '--category-primary': categoryColors.primary,
        '--category-secondary': categoryColors.secondary,
        '--category-border': categoryColors.border
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="enhanced-header">
        <div className="flex items-center">
          <h3 className="enhanced-header-title">{data.label}</h3>
          {getStatusIcon()}
        </div>
        <div className="flex items-center space-x-3">
          {safeData.estimatedCost && (
            <div className="cost-display">
              <DollarSign className="w-3 h-3 inline mr-1" />
              <span className="cost-amount">{safeData.estimatedCost.lamports}</span> lamports
            </div>
          )}
          <div className="program-id-badge">
            {safeData.programId.length > 12 
              ? `${safeData.programId.slice(0, 8)}...${safeData.programId.slice(-4)}`
              : safeData.programId
            }
          </div>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="px-5 py-3 text-sm text-gray-300 border-b border-white border-opacity-5">
          {data.description}
        </div>
      )}

      {/* Accounts Section */}
      {accounts.length > 0 && (
        <CollapsibleSection
          title="Accounts"
          icon={<Database />}
          count={accounts.length}
          accentColor={categoryColors.primary}
          isExpanded={expandedSections.has('accounts')}
          onToggle={() => toggleSection('accounts')}
        >
          <div className="space-y-3">
            {accounts.map((account, idx) => (
              <AccountCard key={idx} account={account} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Parameters Section */}
      {parameters.length > 0 && (
        <CollapsibleSection
          title="Parameters"
          icon={<Settings />}
          count={parameters.length}
          accentColor="#36b37e"
          isExpanded={expandedSections.has('parameters')}
          onToggle={() => toggleSection('parameters')}
        >
          <div className="space-y-3">
            {parameters.map((parameter, idx) => (
              <ParameterField key={idx} parameter={parameter} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Error Codes Section */}
      {errorCodes.length > 0 && (
        <CollapsibleSection
          title="Error Codes"
          icon={<AlertCircle />}
          count={errorCodes.length}
          accentColor="#e53e3e"
          isExpanded={expandedSections.has('errors')}
          onToggle={() => toggleSection('errors')}
        >
          <div className="space-y-3">
            {errorCodes.map((error, idx) => (
              <ErrorItem key={idx} error={error} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <CollapsibleSection
          title="Events"
          icon={<Zap />}
          count={events.length}
          accentColor="#d69e2e"
          isExpanded={expandedSections.has('events')}
          onToggle={() => toggleSection('events')}
        >
          <div className="space-y-3">
            {events.map((event, idx) => (
              <EventItem key={idx} event={event} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Footer */}
      <div className="px-5 py-3 text-xs text-gray-500 border-t border-white border-opacity-5 flex justify-between">
        <span>Category: {safeData.category}</span>
        {safeData.estimatedCost && (
          <span>{safeData.estimatedCost.computeUnits} CU</span>
        )}
      </div>

      {/* React Flow Handles */}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
};