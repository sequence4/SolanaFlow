'use client';

import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Node, 
  Edge,
  Position,
  MarkerType,
  ConnectionLineType,
  NodeTypes,
  applyNodeChanges,
  Handle,
  useUpdateNodeInternals,
  ReactFlowInstance,
  NodeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { initMintFlow } from '@/data/initializeMint/initMintFlow';
import { mintToFlow } from '@/data/mintTo/mintToFlow';
import { transferFlow } from '@/data/transfer/transferFlow';
import InstructionNode from './InstructionNode';
import { TransformedInstruction, Account as _Account, Input as _Input, ErrorCode, Event } from '@/types/instruction';

const ReactFlow = dynamic(() => import('@xyflow/react').then((module) => module.ReactFlow), {
  ssr: false,
});

const Controls = dynamic(() => import('@xyflow/react').then((module) => module.Controls), {
  ssr: false,
});

const transformInstructionData = (instructionNode: Record<string, unknown>): TransformedInstruction => {
  const data = (instructionNode.data as Record<string, unknown>) || {};
  
  return {
    id: (instructionNode.id as string) || "unknown",
    name: (data.label as string) || "Unnamed",
    description: (data.description as string) || "",
    status: "Active",
    accounts: ((data.accounts as Array<Record<string, unknown>>) || []).map((acc) => ({
      name: (acc.label as string),
      type: (acc.type as string),
      description: (acc.description as string) || "",
    })),
    inputs: ((data.parameters as Array<Record<string, unknown>>) || []).map((param) => ({
      name: (param.label as string),
      type: (param.type as string),
      value: (param.value as string) || "",
    })),
    errorCodes: ((data.errorCodes as Array<Record<string, unknown>>) || []).map((code) => ({
      code: (code.code as number) || 0,
      name: (code.name as string) || "",
      msg: (code.msg as string) || ""
    })) as ErrorCode[],
    events: ((data.events as Array<Record<string, unknown>>) || []).map((event) => ({
      name: (event.name as string) || "",
      fields: ((event.fields as Array<Record<string, unknown>>) || []).map((field) => ({
        name: (field.name as string) || "",
        type: (field.type as string) || ""
      }))
    })) as Event[],
    codePreview: (data.code as string) || "",
  };
};

interface InstructionNodeWrapperProps {
  data: TransformedInstruction;
}

const InstructionNodeWrapper = ({ data }: InstructionNodeWrapperProps) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const FIXED_W = 260;

  useLayoutEffect(() => {
    if (!outerRef.current) return;
    outerRef.current.style.width  = `${FIXED_W}px`;
    outerRef.current.style.minWidth = `${FIXED_W}px`;
    outerRef.current.style.maxWidth = `${FIXED_W}px`;
    outerRef.current.style.height = 'auto';
    updateNodeInternals(data.id); 
  }, [data.id, updateNodeInternals]);

  useLayoutEffect(() => {
    if (!outerRef.current) return;
    const ro = new ResizeObserver(() => updateNodeInternals(data.id));
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, [data.id, updateNodeInternals]);

  return (
    <div 
      ref={outerRef}
      className="instruction-wrapper inline-block"
    >
      <div className="instruction-border relative">

        <Handle
          type="source"
          position={Position.Right}
          style={{
            right: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 8,
            height: 8,
            background: '#5d5dff',
            border: '1px solid #333',
          }}
        />

        <Handle
          type="target"
          position={Position.Left}
          style={{
            left: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 8,
            height: 8,
            background: '#5d5dff',
            border: '1px solid #333',
          }}
        />

        <div className="instruction-content">
          <InstructionNode
            id={data.id}
            name={data.name}
            status={data.status}
            accounts={data.accounts}
            inputs={data.inputs}
            errorCodes={data.errorCodes}
            events={data.events}
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
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  const nodeTypes: NodeTypes = {
    instructionGroupNode: InstructionNodeWrapper,
  };

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onInit = useCallback((inst: ReactFlowInstance) => {
    setRf(inst);
    inst.fitView({ padding: 0.2 });   // first paint
  }, []);

  useEffect(() => {
    const h = () => rf?.fitView({ padding: 0.2 });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [rf]);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      
      const initMintNode = initMintFlow.nodes[0];
      const transformedInitMintData = transformInstructionData(initMintNode as Record<string, unknown>);
      
      const mintToNode = mintToFlow.nodes[0];
      const transformedMintToData = transformInstructionData(mintToNode as Record<string, unknown>);
      
      const transferNode = transferFlow.nodes[0];
      const transformedTransferData = transformInstructionData(transferNode as Record<string, unknown>);

      const initialNodes: Node[] = [
        {
          id: transformedInitMintData.id,
          type: "instructionGroupNode",
          data: transformedInitMintData as unknown as Record<string, unknown>,
          position: { x: 100, y: -200 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
          dragHandle: '.node-draggable',
        },
        {
          id: transformedMintToData.id,
          type: "instructionGroupNode",
          data: transformedMintToData as unknown as Record<string, unknown>,
          position: { x: 500, y: 0 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
          dragHandle: '.node-draggable',
        },
        {
          id: transformedTransferData.id,
          type: "instructionGroupNode",
          data: transformedTransferData as unknown as Record<string, unknown>,
          position: { x: 900, y: 200 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          draggable: true,
          dragHandle: '.node-draggable',
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
          target: transformedTransferData.id,
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
    <div className="w-full h-full overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={onInit}
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

        <style jsx global>{`
          /* disable pointer events on both the visible edge and its
             invisible, thicker selection overlay */
          .flow-canvas .react-flow__edge-path,
          .flow-canvas .react-flow__edge-path-selector {
            pointer-events: none;
          }
          
          .react-flow {
            overscroll-behavior: none;
          }
        `}</style>
      </ReactFlow>
    </div>
  );
};

export default InstructionFlow; 