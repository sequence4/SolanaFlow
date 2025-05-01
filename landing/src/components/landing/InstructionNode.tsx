import React, { useState, useRef, useLayoutEffect } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';

const Bullet = ({ color = '#e53e3e' }) => (
  <div
    className="mr-2 w-2 h-2 flex-shrink-0 flex-grow-0 rounded-full"
    style={{ backgroundColor: color }}
  />
);

type InstructionNodeProps = {
  id: string;
  name: string;
  description: string;
  status: string;
  accounts: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  inputs: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  errorCodes: Array<{
    code: number;
    name: string;
    msg: string;
  }>;
  events: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
    }>;
  }>;
};

const InstructionNode: React.FC<InstructionNodeProps> = ({
  id,
  name,
  description,
  status,
  accounts,
  inputs,
  errorCodes = [],
  events = [],
}) => {
  const [activeTab, setActiveTab] = useState<'Context' | 'Inputs' | 'Errors' | 'Events'>('Context');

  const tabColors = {
    Context: '#5d5dff',
    Inputs: '#36b37e',
    Errors: '#e53e3e',
    Events: '#d69e2e'
  };

  const updateNodeInternals = useUpdateNodeInternals();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const CARD_W = 260;
  
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, activeTab, accounts.length, inputs.length, errorCodes.length, events.length, updateNodeInternals]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => updateNodeInternals(id));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [id, updateNodeInternals]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: CARD_W }}
      className="node-draggable bg-[#121218] rounded-xl border border-[#333] overflow-hidden shadow-lg"
    >
      <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#1a1a24]">
        <div className="flex items-center space-x-2">
      
          <div>
            <h3 className="text-white font-medium text-xs">{name}</h3>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <div className="flex items-center px-1.5 py-0.5 text-[10px] bg-[#121218] rounded border border-[#333]">
            <span className="w-1 h-1 rounded-full bg-green-400 mr-1"></span>
            <span className="text-white">{status}</span>
          </div>
        </div>
      </div>

      <div className="flex border-b border-[#333] bg-[#121218]">
        <button 
          className={`cursor-pointer px-3 py-1.5 text-[10px] ${activeTab === 'Context' ? 'text-[#5d5dff] border-b-2 border-[#5d5dff]' : 'text-[#888] hover:text-white'}`}
          onClick={() => setActiveTab('Context')}
        >
          Context
        </button>
        <button 
          className={`cursor-pointer px-3 py-1.5 text-[10px] ${activeTab === 'Inputs' ? 'text-[#36b37e] border-b-2 border-[#36b37e]' : 'text-[#888] hover:text-white'}`}
          onClick={() => setActiveTab('Inputs')}
        >
          Inputs
        </button>
        <button 
          className={`cursor-pointer px-3 py-1.5 text-[10px] ${activeTab === 'Errors' ? 'text-[#e53e3e] border-b-2 border-[#e53e3e]' : 'text-[#888] hover:text-white'}`}
          onClick={() => setActiveTab('Errors')}
        >
          Errors
        </button>
        <button 
          className={`cursor-pointer px-3 py-1.5 text-[10px] ${activeTab === 'Events' ? 'text-[#d69e2e] border-b-2 border-[#d69e2e]' : 'text-[#888] hover:text-white'}`}
          onClick={() => setActiveTab('Events')}
        >
          Events
        </button>
      </div>

      <div 
        className="p-3 overflow-auto max-h-[230px]"
        onWheel={e => e.stopPropagation()}
      >
        {activeTab === 'Context' && (
          <div className="border border-[#333] rounded-lg overflow-hidden bg-[#1a1a24] shadow-[0_0_10px_rgba(93,93,255,0.05)] mb-3">
            <div className="p-1.5 flex items-center justify-between bg-[#1a1a24] border-b border-[#333]">
              <div className="flex items-center">
                <div className="w-1 h-5 bg-[#5d5dff] rounded-sm mr-2"></div>
                <h4 className="text-[10px] font-medium tracking-tight text-white">Accounts</h4>
              </div>
            </div>

            <div className="p-2 bg-[#121218]">
              {accounts.map((account, index) => (
                <div key={index} className="mb-2 last:mb-0 flex items-start text-[10px]">
                  <Bullet color={tabColors.Context} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{account.name}</span>
                      <span className="text-[#888]">{account.type}</span>
                    </div>
                    <p className="text-[#888] mt-0.5">{account.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Inputs' && (
          <div className="border border-[#333] rounded-lg overflow-hidden bg-[#1a1a24] shadow-[0_0_10px_rgba(54,179,126,0.05)] mb-3">
            <div className="p-1.5 flex items-center justify-between bg-[#1a1a24] border-b border-[#333]">
              <div className="flex items-center">
                <div className="w-1 h-5 bg-[#36b37e] rounded-sm mr-2"></div>
                <h4 className="text-[10px] font-medium tracking-tight text-white">Input Parameters</h4>
              </div>
            </div>

            <div className="p-2 bg-[#121218]">
              {inputs.map((input, index) => (
                <div key={index} className="mb-2 last:mb-0 flex items-start text-[10px]">
                  <Bullet color={tabColors.Inputs} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{input.name}</span>
                      <span className="text-[#888]">{input.type}</span>
                    </div>
                    <p className="text-[#888] mt-0.5">Value: {input.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Errors' && (
          <div className="border border-[#333] rounded-lg overflow-hidden bg-[#1a1a24] shadow-[0_0_10px_rgba(229,62,62,0.05)] mb-3">
            <div className="p-1.5 flex items-center justify-between bg-[#1a1a24] border-b border-[#333]">
              <div className="flex items-center">
                <div className="w-1 h-5 bg-[#e53e3e] rounded-sm mr-2"></div>
                <h4 className="text-[10px] font-medium tracking-tight text-white">Error Codes</h4>
              </div>
            </div>

            <div className="p-2 bg-[#121218]">
              {errorCodes.length > 0 ? (
                errorCodes.map((errorCode, index) => (
                  <div key={index} className="mb-2 last:mb-0 flex items-start text-[10px]">
                    <Bullet color={tabColors.Errors} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className="text-white font-medium">{errorCode.name}</span>
                        <span className="text-[#888]">{errorCode.code}</span>
                      </div>
                      <p className="text-[#888] mt-0.5">{errorCode.msg}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[#888] text-[10px] text-center">No error codes defined</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Events' && (
          <div className="border border-[#333] rounded-lg overflow-hidden bg-[#1a1a24] shadow-[0_0_10px_rgba(214,158,46,0.05)] mb-3">
            <div className="p-1.5 flex items-center justify-between bg-[#1a1a24] border-b border-[#333]">
              <div className="flex items-center">
                <div className="w-1 h-5 bg-[#d69e2e] rounded-sm mr-2"></div>
                <h4 className="text-[10px] font-medium tracking-tight text-white">Events</h4>
              </div>
            </div>

            <div className="p-2 bg-[#121218]">
              {events.length > 0 ? (
                events.map((event, index) => (
                  <div key={index} className="mb-3 last:mb-0">
                    <span className="text-white text-xs font-medium">{event.name}</span>
                    <ul className="mt-1 pl-0">
                      {event.fields.map((field, idx) => (
                        <li key={idx} className="flex items-start text-[10px] mt-1">
                          <Bullet color={tabColors.Events} />
                          <span className="text-[#888]">
                            {field.name}: {field.type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="text-[#888] text-[10px] text-center">No events defined</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructionNode; 