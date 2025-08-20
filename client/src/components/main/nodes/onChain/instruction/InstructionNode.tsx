import React, { useContext, useState, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";

// Styles
import './style/instructionStyle.css';
import "@/styles/nodes/basicNodeStyle.css";
import '@/styles/modern-instruction-node.css';
import { darkTheme } from '@/styles/theme';

// Icons
import { ChevronDown, ChevronRight, Check, Key, Database, Edit2, Copy, Shield, XCircle, Zap, Cpu, Hash, Text } from "lucide-react";

interface FileInfo {
  name: string;
  ext: string;
  type: string;
  code?: string;
  path: string;
}

interface ProjectContextType {
  setActiveTab: (tab: string) => void;
  setSelectedFile: (file: FileInfo) => void;
}

// Account types
interface Account {
  label: string;
  type: string;
  description?: string;
  info?: any;
  isWritable?: boolean;
  isSigner?: boolean;
}

// Parameter types
interface Parameter {
  label: string;
  type: string;
  value?: string;
}

// Error code types
interface ErrorCode {
  name: string;
  message: string;
}

// Event types
interface Event {
  name: string;
  type?: string;
  description: string;
  fields?: Array<{ name: string; type: string }>;
}

interface InstructionGroupNodeData {
  label: string;
  description?: string;
  accounts?: Account[];
  parameters?: Parameter[];
  errorCodes?: ErrorCode[];
  events?: Event[];
  code?: string;
}

const ProjectContext = React.createContext<ProjectContextType>({} as ProjectContextType);

// Account Section Component
const AccountSection = ({ account }: { account: Account }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [publicKey, setPublicKey] = useState("11111111111111111111111111111111");
  const [isEditingPublicKey, setIsEditingPublicKey] = useState(false);
  const [owner, setOwner] = useState("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [lamports, setLamports] = useState("0.01000000");
  const [isEditingLamports, setIsEditingLamports] = useState(false);
  const [rentEpoch, setRentEpoch] = useState("123");
  const [isEditingRentEpoch, setIsEditingRentEpoch] = useState(false);

  const publicKeyInputRef = useRef<HTMLInputElement>(null);
  const ownerInputRef = useRef<HTMLInputElement>(null);
  const lamportsInputRef = useRef<HTMLInputElement>(null);
  const rentEpochInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingPublicKey && publicKeyInputRef.current) {
      publicKeyInputRef.current.focus();
    }
  }, [isEditingPublicKey]);

  useEffect(() => {
    if (isEditingOwner && ownerInputRef.current) {
      ownerInputRef.current.focus();
    }
  }, [isEditingOwner]);

  useEffect(() => {
    if (isEditingLamports && lamportsInputRef.current) {
      lamportsInputRef.current.focus();
    }
  }, [isEditingLamports]);

  useEffect(() => {
    if (isEditingRentEpoch && rentEpochInputRef.current) {
      rentEpochInputRef.current.focus();
    }
  }, [isEditingRentEpoch]);

  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(publicKey);
  };

  const handleCopyOwner = () => {
    navigator.clipboard.writeText(owner);
  };

  const isWritable = account.isWritable || false;
  const isSigner = account.isSigner || false;
  const isProgramId = account.type === "Program";
  const description = account.description || "";

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center mb-1 group relative">
        <div className="flex items-center cursor-pointer flex-1" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[#5d5dff] mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#5d5dff] mr-1" />
          )}

          <span className={`text-sm`} style={{ color: darkTheme.text.primary }}>
            {account.label}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Account Type Badges */}
          {account.type === "AccountInfo" && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.text.secondary,
                color: darkTheme.text.secondary,
              }}
            >
              AccountInfo
            </span>
          )}
          {account.type === "Program" && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.accent.blue,
                color: darkTheme.accent.blue,
              }}
            >
              Program
            </span>
          )}
          {account.type === "Sysvar" && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.accent.cyan,
                color: darkTheme.accent.cyan,
              }}
            >
              Sysvar
            </span>
          )}
          {!account.type && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.text.secondary,
                color: darkTheme.text.secondary,
              }}
            >
              Unknown
            </span>
          )}

          {/* Account Properties */}
          {isSigner && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.accent.blue,
                color: darkTheme.accent.blue,
              }}
            >
              Signer
            </span>
          )}
          {isWritable && (
            <span 
              className="text-[8px] px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: darkTheme.background.primary,
                borderColor: darkTheme.accent.green,
                color: darkTheme.accent.green,
              }}
            >
              Writable
            </span>
          )}
        </div>
      </div>

      {description && !isExpanded && (
        <div className="flex items-center ml-5 group">
          <p className="text-xs text-[#888] font-sans flex-1">{description}</p>
        </div>
      )}

      {isExpanded && (
        <div className="ml-5 mt-2 space-y-3">
          {description && (
            <div className="flex items-center group">
              <p className="text-xs text-[#888] font-sans flex-1">{description}</p>
            </div>
          )}

          {/* Public Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Key className="h-3 w-3 text-[#5d5dff] mr-1" />
                <span className="text-xs text-[#5d5dff]">Public Key</span>
              </div>
              <span className="text-xs bg-[#121218] px-1.5 py-0.5 rounded-sm border border-[#333]">Address</span>
            </div>
            <div className="bg-[#1a1a24] p-1.5 rounded text-xs font-mono border border-[#333] text-[#e1e2e6] relative overflow-hidden group editable-field">
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5d5dff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"
              ></div>

              {isEditingPublicKey ? (
                <input
                  ref={publicKeyInputRef}
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  onBlur={() => setIsEditingPublicKey(false)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingPublicKey(false)}
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#5d5dff] text-white editable-input"
                />
              ) : (
                <>
                  {publicKey}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={handleCopyPublicKey} className="p-0.5 rounded hover:bg-[#333]">
                      <Copy className="h-3 w-3 text-[#888] hover:text-white" />
                    </button>
                    <button onClick={() => setIsEditingPublicKey(true)} className="p-0.5 rounded hover:bg-[#333] edit-button">
                      <Edit2 className="h-3 w-3 text-[#888] hover:text-[#5d5dff]" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Owner */}
          {!isProgramId && (
            <div className="space-y-1">
              <div className="flex items-center">
                <Database className="h-3 w-3 text-[#5d5dff] mr-1" />
                <span className="text-xs text-[#5d5dff]">Owner</span>
              </div>
              <div className="bg-[#1a1a24] p-1.5 rounded-sm text-xs font-mono border border-[#333] text-[#e1e2e6] relative overflow-hidden group editable-field">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5d5dff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"
                ></div>

                {isEditingOwner ? (
                  <input
                    ref={ownerInputRef}
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    onBlur={() => setIsEditingOwner(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingOwner(false)}
                    className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#5d5dff] text-white editable-input"
                  />
                ) : (
                  <>
                    {owner}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={handleCopyOwner} className="p-0.5 rounded hover:bg-[#333]">
                        <Copy className="h-3 w-3 text-[#888] hover:text-white" />
                      </button>
                      <button onClick={() => setIsEditingOwner(true)} className="p-0.5 rounded hover:bg-[#333] edit-button">
                        <Edit2 className="h-3 w-3 text-[#888] hover:text-[#5d5dff]" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Error Section Component
const ErrorSection = ({ error }: { error: ErrorCode }) => {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center mb-1 group">
        <div className="w-2 h-2 rounded-sm bg-[#e53e3e] mr-2"></div>
        <span className="text-sm flex-1">{error.name}</span>
      </div>

      <div className="ml-4 p-2 bg-[#1a1a24] rounded-sm border border-[#333] text-xs relative overflow-hidden group">
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#e53e3e]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"
        ></div>

        <div className="flex items-center">
          <XCircle className="h-3 w-3 text-[#e53e3e] mr-1 flex-shrink-0" />
          <p className="text-[#888] font-sans flex-1">{error.message}</p>
        </div>

        <div className="absolute -bottom-2 -right-2">
          <div className="w-8 h-8 rounded-full bg-[#e53e3e]/5 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#e53e3e]/10"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Event Section Component
const EventSection = ({ event }: { event: Event }) => {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center mb-1 group">
        <div className="w-2 h-2 rounded-sm bg-[#d69e2e] mr-2"></div>
        <span className="text-sm flex-1">{event.name}</span>
      </div>

      <div className="ml-4 p-2 bg-[#1a1a24] rounded-sm border border-[#333] text-xs relative overflow-hidden group">
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d69e2e]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"
        ></div>

        <div className="flex items-center">
          <Zap className="h-3 w-3 text-[#d69e2e] mr-1 flex-shrink-0" />
          <p className="text-[#888] font-sans flex-1">{event.description}</p>
        </div>

        <div className="absolute -bottom-2 -right-2">
          <div className="w-8 h-8 rounded-full bg-[#d69e2e]/5 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#d69e2e]/10"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Input Section Component
const InputSection = ({ parameter }: { parameter: Parameter }) => {
  const [value, setValue] = useState(parameter.value || "");
  const [isEditingValue, setIsEditingValue] = useState(false);
  
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingValue && valueInputRef.current) {
      valueInputRef.current.focus();
    }
  }, [isEditingValue]);

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center mb-1 group">
        <div className="w-2 h-2 rounded-sm bg-[#36b37e] mr-2"></div>
        <span className="text-sm flex-1">{parameter.label}</span>
        <span className="ml-auto text-xs bg-[#121218] px-1.5 py-0.5 rounded-sm border border-[#333] font-mono">
          {parameter.type}
        </span>
      </div>

      <div className="ml-4 bg-[#1a1a24] p-2 rounded-sm text-sm border border-[#333] font-mono flex items-center relative overflow-hidden group editable-field">
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#36b37e]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"
        ></div>

        <Cpu className="h-3 w-3 text-[#36b37e] mr-2" />

        {isEditingValue ? (
          <input
            ref={valueInputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setIsEditingValue(false)}
            onKeyDown={(e) => e.key === "Enter" && setIsEditingValue(false)}
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#36b37e] text-white editable-input"
          />
        ) : (
          <>
            <span className="flex-1">{value}</span>
            <button
              onClick={() => setIsEditingValue(true)}
              className="edit-button"
            >
              <Edit2 className="h-3 w-3 text-[#888] hover:text-[#36b37e]" />
            </button>
          </>
        )}

        <div className="absolute -bottom-2 -right-2">
          <div className="w-8 h-8 rounded-full bg-[#36b37e]/5 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#36b37e]/10"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Content Section
const ContentSection = ({ 
  title, 
  icon,
  accentColor,
  children,
  defaultOpen = false 
}: { 
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  return (
    <div 
      className="border rounded-lg overflow-hidden shadow-lg mb-4 last:mb-0"
      style={{
        backgroundColor: darkTheme.background.tertiary,
        borderColor: darkTheme.border.default,
        boxShadow: '0 0 10px rgba(77, 124, 254, 0.05)',
      }}
    >
      <div
        className="p-2 flex items-center justify-between border-b"
        style={{
          backgroundColor: darkTheme.background.tertiary,
          borderColor: darkTheme.border.default,
        }}
      >
        <div className="flex items-center">
          <div className={`w-1 h-6 ${accentColor} rounded-sm mr-2`}></div>
          <h4 className="text-sm font-medium tracking-tight" style={{ color: darkTheme.text.primary }}>{title}</h4>
        </div>
      </div>

      <div className="p-3" style={{ backgroundColor: darkTheme.background.primary }}>
        {children}
      </div>
    </div>
  );
};

export function InstructionGroupNode({ data }: { data: InstructionGroupNodeData }) {
  const { setActiveTab, setSelectedFile } = useContext(ProjectContext);
  
  const accounts = data.accounts || [];
  const parameters = data.parameters || [];
  const errorCodes = data.errorCodes || [];
  const events = data.events || [];
  
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>("Context");
  
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };
  
  return (
    <div
      className="flex flex-col border transition-all ease-in-out parent-node shadow-2xl backdrop-blur-xl"
      style={{
        width: '440px',
        minWidth: '440px',
        maxWidth: '440px',
        height: '500px',
        position: 'relative',
        boxSizing: 'border-box',
        backgroundColor: darkTheme.background.secondary,
        borderColor: darkTheme.border.default,
        borderRadius: '12px',
        color: darkTheme.text.primary,
        backdropFilter: `blur(${darkTheme.glass.blur})`,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3), 0 0 20px rgba(77, 124, 254, 0.1)',
      }}
    >
      {/* Main Header */}
      <div
        className="p-3 flex items-center border-b pl-6 sticky top-0 z-10 rounded-t-xl"
        style={{
          backgroundColor: darkTheme.background.tertiary,
          borderColor: darkTheme.border.default,
        }}
      >
        <h3 className="font-medium flex-1 tracking-tight" style={{ color: darkTheme.text.primary }}>{data.label}</h3>
        <div className="flex items-center space-x-2">
          <span 
            className="text-xs px-2 py-0.5 rounded-sm border font-mono"
            style={{
              backgroundColor: darkTheme.background.primary,
              borderColor: darkTheme.border.default,
              color: darkTheme.accent.blue,
            }}
          >
            ID: 12345
          </span>
          <button 
            className="p-1 rounded transition-colors"
            style={{ color: darkTheme.text.secondary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = darkTheme.background.primary;
              e.currentTarget.style.color = darkTheme.accent.blue;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = darkTheme.text.secondary;
            }}
          >
            <Text className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div 
          className="px-6 py-3 text-sm"
          style={{
            backgroundColor: darkTheme.background.primary,
            color: darkTheme.text.secondary,
          }}
        >
          {data.description}
        </div>
      )}
      
      {/* Tabs */}
      <div 
        className="flex border-b"
        style={{
          backgroundColor: darkTheme.background.primary,
          borderColor: darkTheme.border.default,
        }}
      >
        <button 
          className={`px-4 py-2 text-sm transition-colors ${activeSection === "Context" ? "border-b-2" : "hover:text-white"}`}
          style={{
            color: activeSection === "Context" ? darkTheme.accent.blue : darkTheme.text.secondary,
            borderColor: activeSection === "Context" ? darkTheme.accent.blue : 'transparent',
          }}
          onClick={() => setActiveSection("Context")}
        >
          Context
        </button>
        <button 
          className={`px-4 py-2 text-sm transition-colors ${activeSection === "Inputs" ? "border-b-2" : "hover:text-white"}`}
          style={{
            color: activeSection === "Inputs" ? darkTheme.accent.green : darkTheme.text.secondary,
            borderColor: activeSection === "Inputs" ? darkTheme.accent.green : 'transparent',
          }}
          onClick={() => setActiveSection("Inputs")}
        >
          Inputs
        </button>
        <button 
          className={`px-4 py-2 text-sm transition-colors ${activeSection === "Errors" ? "border-b-2" : "hover:text-white"}`}
          style={{
            color: activeSection === "Errors" ? darkTheme.accent.red : darkTheme.text.secondary,
            borderColor: activeSection === "Errors" ? darkTheme.accent.red : 'transparent',
          }}
          onClick={() => setActiveSection("Errors")}
        >
          Errors
        </button>
        <button 
          className={`px-4 py-2 text-sm transition-colors ${activeSection === "Events" ? "border-b-2" : "hover:text-white"}`}
          style={{
            color: activeSection === "Events" ? darkTheme.accent.cyan : darkTheme.text.secondary,
            borderColor: activeSection === "Events" ? darkTheme.accent.cyan : 'transparent',
          }}
          onClick={() => setActiveSection("Events")}
        >
          Events
        </button>
        <button 
          className={`px-4 py-2 text-sm transition-colors ${activeSection === "Outputs" ? "border-b-2" : "hover:text-white"}`}
          style={{
            color: activeSection === "Outputs" ? darkTheme.accent.purple : darkTheme.text.secondary,
            borderColor: activeSection === "Outputs" ? darkTheme.accent.purple : 'transparent',
          }}
          onClick={() => setActiveSection("Outputs")}
        >
          Outputs
        </button>
      </div>

      {/* Content - Scrollable area */}
      <div 
        ref={contentRef}
        className="p-4 pl-6 flex-grow w-[99.7%] overflow-y-auto custom-scrollbar scrollbar-thin nowheel" 
        style={{
          backgroundColor: darkTheme.background.primary,
          '--scrollbar-thumb': darkTheme.border.default,
          '--scrollbar-track': darkTheme.background.tertiary,
        } as React.CSSProperties}
        onWheel={handleWheel}
      >
        {activeSection === "Context" && accounts.length > 0 && (
          <>
            {accounts.map((account, idx) => (
              <AccountSection key={idx} account={account} />
            ))}
          </>
        )}

        {activeSection === "Inputs" && parameters.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-[#36b37e]">Inputs</h4>
              <span className="text-xs bg-[#121218] px-2 py-0.5 rounded-sm border border-[#333] font-mono">
                Parameters
              </span>
            </div>
            {parameters.map((parameter, idx) => (
              <InputSection key={idx} parameter={parameter} />
            ))}
          </>
        )}

        {activeSection === "Errors" && errorCodes.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-[#e53e3e]">Initialize Mint Error Codes</h4>
              <span className="text-xs bg-[#121218] px-2 py-0.5 rounded-sm border border-[#333] font-mono">
                Errors
              </span>
            </div>
            {errorCodes.map((error, idx) => (
              <ErrorSection key={idx} error={error} />
            ))}
          </>
        )}

        {activeSection === "Events" && events.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-[#d69e2e]">Initialize Mint Events</h4>
              <span className="text-xs bg-[#121218] px-2 py-0.5 rounded-sm border border-[#333] font-mono">
                Events
              </span>
            </div>
            {events.map((event, idx) => (
              <EventSection key={idx} event={event} />
            ))}
          </>
        )}

        {activeSection === "Outputs" && (
          <div className="flex items-center justify-center h-full text-[#888]">
            No outputs defined
          </div>
        )}
      </div>

      {/* Footer with counters - Fixed at bottom */}
      <div 
        className="border-t p-3 text-xs font-mono flex justify-between items-center rounded-b-xl"
        style={{
          backgroundColor: darkTheme.background.primary,
          borderColor: darkTheme.border.default,
          color: darkTheme.text.secondary,
        }}
      >
        <div className="flex items-center">
          <div 
            className="flex h-5 w-5 items-center justify-center rounded-full border mr-1"
            style={{
              backgroundColor: darkTheme.background.tertiary,
              borderColor: darkTheme.border.default,
            }}
          >
            <Hash className="h-3 w-3" style={{ color: darkTheme.accent.blue }} />
          </div>
          <span>Accounts: {accounts.length}</span>
        </div>
        <div className="flex items-center">
          <div 
            className="flex h-5 w-5 items-center justify-center rounded-full border mr-1"
            style={{
              backgroundColor: darkTheme.background.tertiary,
              borderColor: darkTheme.border.default,
            }}
          >
            <Hash className="h-3 w-3" style={{ color: darkTheme.accent.green }} />
          </div>
          <span>Inputs: {parameters.length}</span>
        </div>
        <div className="flex items-center">
          <div 
            className="flex h-5 w-5 items-center justify-center rounded-full border mr-1"
            style={{
              backgroundColor: darkTheme.background.tertiary,
              borderColor: darkTheme.border.default,
            }}
          >
            <Hash className="h-3 w-3" style={{ color: darkTheme.accent.red }} />
          </div>
          <span>Errors: {errorCodes.length}</span>
        </div>
        <div className="flex items-center">
          <div 
            className="flex h-5 w-5 items-center justify-center rounded-full border mr-1"
            style={{
              backgroundColor: darkTheme.background.tertiary,
              borderColor: darkTheme.border.default,
            }}
          >
            <Hash className="h-3 w-3" style={{ color: darkTheme.accent.cyan }} />
          </div>
          <span>Events: {events.length}</span>
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
}
