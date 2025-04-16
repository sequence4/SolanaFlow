'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { 
  Node, 
  Edge,
  Position,
  MarkerType,
  ConnectionLineType,
  NodeTypes,
  applyNodeChanges,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { initMintFlow } from '@/data/nodes/onChain/instructions/spl-token-program/initializeMint/initMintFlow';
import { mintTo } from '@/data/nodes/onChain/instructions/spl-token-program/mintTo/mintTo';

import InstructionNode from './InstructionNode';

const ReactFlow = dynamic(() => import('@xyflow/react').then((module) => module.ReactFlow), {
  ssr: false,
});

const Controls = dynamic(() => import('@xyflow/react').then((module) => module.Controls), {
  ssr: false,
});

const transformInstructionData = (instructionNode: any) => {
  const data = instructionNode.data || {};
  
  return {
    id: instructionNode.id || "unknown",
    name: data.label || "Unnamed",
    description: data.description || "",
    status: "Active",
    accounts: (data.accounts || []).map((acc: any) => ({
      name: acc.label,
      type: acc.type,
      description: acc.description || "",
    })),
    inputs: (data.parameters || []).map((param: any) => ({
      name: param.label,
      type: param.type,
      value: param.value || "",
    })),
    codePreview: data.code || "",
  };
};

const InstructionNodeWrapper = ({ data }: any) => {
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="instruction-wrapper">
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ 
          background: '#5d5dff',
          width: '8px',
          height: '8px',
          border: '1px solid #333' 
        }} 
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ 
          background: '#5d5dff',
          width: '8px',
          height: '8px',
          border: '1px solid #333' 
        }} 
      />
      <div className="instruction-border">
        <div className="instruction-content" onWheel={handleWheel}>
          <InstructionNode
            id={data.id}
            name={data.name}
            description={data.description}
            status={data.status}
            accounts={data.accounts}
            inputs={data.inputs}
            codePreview={data.codePreview}
          />
        </div>
      </div>
    </div>
  );
};

const InstructionFlow = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [mounted, setMounted] = useState(false);

  const nodeTypes: NodeTypes = {
    instructionGroupNode: InstructionNodeWrapper,
  };

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      
      const initMintNode = initMintFlow.nodes[0];
      const transformedInitMintData = transformInstructionData(initMintNode);
      
      const transformedMintToData = transformInstructionData(mintTo);
      
      const mockTransferData = {
        id: "transfer-instruction",
        type: "instructionGroupNode",
        data: {
          label: "Transfer",
          description: "Transfers tokens from one account to another",
          code: `pub fn transfer(
ctx: Context<Transfer>,
amount: u64
) -> Result<()> {
let cpi_accounts = Transfer {
  from: ctx.accounts.source.to_account_info(),
  to: ctx.accounts.destination.to_account_info(),
  authority: ctx.accounts.authority.to_account_info(),
};

token::transfer(
  CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    cpi_accounts
  ),
  amount
)?;

Ok(())
}`,
          accounts: [
            { label: "Source", type: "Pubkey", description: "The source token account" },
            { label: "Destination", type: "Pubkey", description: "The destination token account" },
            { label: "Authority", type: "Pubkey", description: "The account owner" }
          ],
          parameters: [
            { label: "Amount", type: "u64", value: "500000000" }
          ]
        }
      };
      const transformedTransferData = transformInstructionData(mockTransferData);

      const initialNodes: Node[] = [
        {
          id: transformedInitMintData.id,
          type: "instructionGroupNode",
          data: transformedInitMintData,
          position: { x: 100, y: -200 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
        },
        {
          id: transformedMintToData.id,
          type: "instructionGroupNode",
          data: transformedMintToData,
          position: { x: 500, y: 0 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
        },
        {
          id: mockTransferData.id,
          type: "instructionGroupNode",
          data: transformedTransferData,
          position: { x: 900, y: 200 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
        },
      ];

      const initialEdges: Edge[] = [
        {
          id: 'initMint->mintTo',
          source: transformedInitMintData.id,
          target: transformedMintToData.id,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, strokeDasharray: '5,5' },
          className: 'gradient-edge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: 'url(#edge-gradient)'
          },
        },
        {
          id: 'mintTo->transfer',
          source: transformedMintToData.id,
          target: mockTransferData.id,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, strokeDasharray: '5,5' },
          className: 'gradient-edge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: 'url(#edge-gradient)'
          },
        },
      ];

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="w-full h-full overflow-auto">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.55}
        maxZoom={1.5}
        connectionLineType={ConnectionLineType.SmoothStep}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        className="flow-canvas"
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        panOnScroll={false}
        panOnDrag={true}
      >
        {/* Define SVG gradient for edges */}
        <svg width="0" height="0">
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5f88dc" />
              <stop offset="50%" stopColor="#1cf6a0" />
              <stop offset="100%" stopColor="#9945ff" />
            </linearGradient>
            
            <marker
              id="gradient-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="url(#edge-gradient)" />
            </marker>
          </defs>
        </svg>
        
        <Controls 
          showInteractive={false}
          showZoom={true}
          position="bottom-left"
        />
      </ReactFlow>
      
      <style jsx global>{`
        .instruction-wrapper {
          width: 300px;
          height: 370px;
          position: relative;
        }
        .instruction-border {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        .instruction-border::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: 8px;
          background: linear-gradient(90deg, #5f88dc, #1cf6a0, #9945ff, #5f88dc);
          background-size: 300% 300%;
          -webkit-mask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: border-gradient 3s ease infinite;
          z-index: 2;
          pointer-events: none;
        }
        .instruction-content {
          width: 100%;
          height: 100%;
          max-height: 370px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: #333 #121218;
        }
        .instruction-content::-webkit-scrollbar {
          width: 4px;
        }
        .instruction-content::-webkit-scrollbar-track {
          background: #121218;
        }
        .instruction-content::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 4px;
        }
        .react-flow__node-instructionGroupNode {
          padding: 0;
          border-radius: 8px;
          width: auto;
          height: auto;
          border: none;
          background: transparent;
        }
        .flow-canvas {
          background-image: radial-gradient(#2a2d4a 1px, transparent 1px);
          background-size: 24px 24px;
          width: 100%;
          min-height: 600px;
        }
        .react-flow__handle {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #5d5dff;
          border: 1px solid #333;
        }
        .react-flow__handle-right {
          right: -3px;
        }
        .react-flow__handle-left {
          left: -3px;
        }
        .react-flow__controls {
          background: #0a0b14;
          border: 1px solid #2a2d4a;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .react-flow__controls-button {
          border: none;
          color: #5d5dff;
          background: #0a0b14;
        }
        .react-flow__controls-button:hover {
          background: #1e2033;
        }
        
        /* Enhanced Gradient edge styling */
        .gradient-edge path {
          stroke-dasharray: 5, 5;
          stroke: url(#edge-gradient) !important;
          animation: flowEdgeGradient 3s linear infinite, gradientPulse 3s ease-in-out infinite;
          stroke-linecap: round;
          filter: drop-shadow(0 0 3px rgba(28, 246, 160, 0.5));
        }
        
        @keyframes flowEdgeGradient {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        
        /* Improved glow effect to the edges */
        .gradient-edge path {
          filter: drop-shadow(0 0 3px rgba(28, 246, 160, 0.5));
        }
        
        /* Enhanced style for the edge arrow markers */
        .react-flow__arrowhead {
          fill: url(#edge-gradient) !important;
          filter: drop-shadow(0 0 2px rgba(28, 246, 160, 0.5));
        }
        
        /* Update SmoothStep edges specifically */
        .react-flow__edge.smoothstep .react-flow__edge-path {
          stroke-width: 3;
        }
        
        /* Make the gradient more visible */
        .react-flow__edge.animated.gradient-edge .react-flow__edge-path {
          stroke: url(#edge-gradient) !important;
          stroke-width: 3;
          stroke-dasharray: 5, 5;
          animation: flowEdgeGradient 3s linear infinite, gradientPulse 3s ease-in-out infinite;
        }
        
        @keyframes gradientPulse {
          0%, 100% { 
            filter: drop-shadow(0 0 2px rgba(28, 246, 160, 0.3)); 
          }
          50% { 
            filter: drop-shadow(0 0 4px rgba(28, 246, 160, 0.6));
          }
        }
        
        /* Ensure the default stroke isn't overriding the gradient */
        .react-flow__edge-path {
          stroke: none;
        }
        
        /* Make sure the edge interactivity is preserved */
        .react-flow__edge {
          pointer-events: stroke;
        }
        
        /* Ensure marker ends are properly visible */
        .react-flow__edge .react-flow__edge-path {
          marker-end: url(#gradient-arrow);
        }
        
        @keyframes dashdraw {
          0% {
            stroke-dashoffset: 10;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes border-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        /* Ensure ReactFlow pane has proper styling */
        .react-flow__pane {
          cursor: default;
        }
      `}</style>
    </div>
  );
};

export default InstructionFlow; 