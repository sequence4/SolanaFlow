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
import { JSX } from 'react/jsx-runtime';
import { initMintFlow } from '@/data/initializeMint/initMintFlow';
import { mintTo } from '@/data/mintTo/mintTo';
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
    </div>
  );
};

export default InstructionFlow; 