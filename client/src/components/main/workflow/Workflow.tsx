import React, { useCallback, useMemo, useEffect, useContext } from 'react';

import {
    ReactFlow,
    Controls,
    addEdge,
    ReactFlowProvider,
    applyEdgeChanges,
    applyNodeChanges,
    ControlButton,
    useReactFlow,
  } from '@xyflow/react';

import { workflowNodeTypes } from '@/data/nodes/nodeTypes';
import { AccountsBox } from '@/components/main/workflow/AccountsBox';

import '@xyflow/react/dist/style.css';
import '@/styles/workflow/workflowStyle.css';
import '@/styles/reactflow/reactflow-style.css';

import ProjectContext from "@/context/project/ProjectContext";
import UxContext from "@/context/ux/UxContext";
import { ProjectStateUpdater } from "@/context/project/ProjectContextTypes";

import { handleDrop } from '@/utils/tabs/workflow/onDrop';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlusIcon, Trash2, Layers } from 'lucide-react';

// Separate component that uses the useReactFlow hook
interface ReactFlowContentProps {
    projectState: any;
    setProjectState: ((updater: ProjectStateUpdater) => void) | undefined;
    nodeTypes: any;
    uxOpenPanel: any;
    setUxOpenPanel: React.Dispatch<React.SetStateAction<any>>;
    setProjectContext: React.Dispatch<React.SetStateAction<any>>;
    projectId: string | undefined;
    publicKey: any;
}

const ReactFlowContent = ({ 
    projectState, 
    setProjectState, 
    nodeTypes, 
    uxOpenPanel, 
    setUxOpenPanel,
    setProjectContext,
    projectId,
    publicKey
}: ReactFlowContentProps) => {
    const reactFlow = useReactFlow();
    
    const onNodesChange = useCallback(
        (changes: any) => {
          if (!setProjectState) return;
          setProjectState((prev: any) => ({
            ...prev,
            nodes: applyNodeChanges(changes, prev.nodes),
          }));
        },
        [setProjectState]
    );
      
    const onEdgesChange = useCallback(
        (changes: any) => {
          if (!setProjectState) return;
          setProjectState((prev: any) => ({
            ...prev,
            edges: applyEdgeChanges(changes, prev.edges),
          }));
        },
        [setProjectState]
    );

    const onConnect = useCallback(
      (connection: any) => {
        if (!setProjectState) return;
        setProjectState((prev: any) => ({
          ...prev,
          edges: addEdge(connection, prev.edges),
        }));
      },
      [setProjectState]
    );

    const onDrop = useCallback(
        async (event: React.DragEvent<HTMLDivElement>) => {
          if (!setProjectState) {
            console.log("setProjectState is not defined");
            return;
          }

          const pubkeyString = publicKey?.toBase58() || undefined;
          console.log("Handling drop in Workflow with projectId:", projectId);

          try {
            await handleDrop(
              event, 
              setUxOpenPanel as React.Dispatch<React.SetStateAction<any>>, 
              setProjectState, 
              20, 
              pubkeyString,
              projectId,
              setProjectContext,
              reactFlow
            );
            console.log("Node drop completed with code injection");
          } catch (error) {
            console.error("Error during node drop:", error);
          }
        },
        [setUxOpenPanel, setProjectState, publicKey, projectId, setProjectContext, reactFlow]
    );

    const onNodeClick = useCallback((_event: any, node: any) => {
        if (node.type === 'instructionGroupNode') {
            // setActiveInstructionId((prevId) => (prevId === node.id ? null : node.id));
        }
    }, []);

    function handleClearCanvas() {
        if (!setProjectState) return;
        setProjectState((prev: any) => ({
            ...prev,
            nodes: [],
            edges: [],
            instructions: [],
        }));
    }

    const toggleAccountsBox = useCallback(() => {
        setUxOpenPanel(uxOpenPanel === 'accountsBox' ? 'none' : 'accountsBox');
    }, [uxOpenPanel, setUxOpenPanel]);
    
    return (
        <div className="relative h-full">
            <ReactFlow 
                nodes={projectState.nodes} 
                edges={projectState.edges} 
                style={{
                    background: '#0a0a0b',
                    backgroundImage: `
                        linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                        radial-gradient(circle at 20% 50%, rgba(77, 124, 254, 0.02) 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.02) 0%, transparent 50%),
                        radial-gradient(circle at 40% 20%, rgba(34, 197, 94, 0.02) 0%, transparent 50%)
                    `,
                    backgroundSize: '20px 20px, 20px 20px, 100% 100%, 100% 100%, 100% 100%',
                    border: 'none',
                    position: 'relative',
                }}
                snapToGrid={true}
                snapGrid={[15, 15]}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={true}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onConnect={onConnect}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            defaultEdgeOptions={{ 
                style: { 
                    stroke: 'rgba(77, 124, 254, 0.3)',
                    strokeWidth: 2,
                    strokeDasharray: '5 5',
                    animation: 'dashdraw 0.5s linear infinite',
                },
                animated: true,
                type: 'smoothstep',
            }}
        >
            <Controls 
                className="backdrop-blur-xl"
                position="top-left" 
                orientation="horizontal"
                style={{ 
                    backgroundColor: 'hsl(0 0% 9%)',
                    border: '1px solid hsl(0 0% 14.9%)',
                    color: 'hsl(0 0% 98%)',
                    zIndex: 9999,
                    padding: '8px',
                    gap: '6px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }} 
            >
                <ControlButton 
                    onClick={handleClearCanvas} 
                    title="Clear Canvas"
                    style={{
                        backgroundColor: 'hsl(0 0% 3.9%)',
                        border: '1px solid hsl(0 0% 14.9%)',
                        borderRadius: '6px',
                        padding: '8px',
                        color: 'hsl(0 0% 98%)',
                        transition: 'all 0.2s ease',
                    }}
                    className="hover:opacity-80 hover:scale-105"
                >
                    <Trash2 size={16} style={{ color: 'hsl(0 0% 98%)' }} />
                </ControlButton>
                <ControlButton 
                    onClick={toggleAccountsBox}
                    title="Toggle Accounts"
                    style={{
                        backgroundColor: 'hsl(0 0% 3.9%)',
                        border: '1px solid hsl(0 0% 14.9%)',
                        borderRadius: '6px',
                        padding: '8px',
                        color: 'hsl(0 0% 98%)',
                        transition: 'all 0.2s ease',
                    }}
                    className="hover:opacity-80 hover:scale-105"
                >
                    <Layers size={16} style={{ color: 'hsl(0 0% 98%)' }} />
                </ControlButton>
            </Controls>
        </ReactFlow>
        </div>
    );
};

const Workflow = () => {
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { details, id: projectId } = projectContext;
    
    if (!details) {
        console.warn("No 'details' in projectContext, cannot render workflow fully.");
        return (
          <div className="flex items-center justify-center w-full h-full text-gray-300">
            No project details available
          </div>
        );
    }
    
    const { projectState, setProjectState } = details;
    const { uxOpenPanel, setUxOpenPanel } = useContext(UxContext);
    const { publicKey } = useWallet();
    const nodeTypes = useMemo(() => workflowNodeTypes, []);

    useEffect(() => {
        console.log("Project Context in Workflow:", projectContext);
        console.log("Project ID in Workflow:", projectId);
    }, [projectContext, projectId]);

    return (
        <div className="relative w-full h-full border-none">
            <ReactFlowProvider>
                <ReactFlowContent
                    projectState={projectState}
                    setProjectState={setProjectState}
                    nodeTypes={nodeTypes}
                    uxOpenPanel={uxOpenPanel}
                    setUxOpenPanel={setUxOpenPanel}
                    setProjectContext={setProjectContext}
                    projectId={projectId}
                    publicKey={publicKey}
                />
            </ReactFlowProvider>

            {/* Empty Canvas Message */}
            {(projectState?.nodes?.length || 0) === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center px-2 py-4 rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/[0.06]">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-white/5 mb-4">
                            <PlusIcon className="w-4 h-4 text-blue-400/40" />
                        </div>
                        <h3 className="text-xmd font-semibold mb-2 text-white/30">Drag and drop nodes to start building your dApp</h3>
                    </div>
                </div>
            )}

            {/* AccountsBox Panel */}
            {uxOpenPanel === 'accountsBox' && (
                <div className="absolute top-14 right-6 z-50">
                    <div 
                        className="backdrop-blur-xl rounded-xl shadow-2xl bg-card border-border"
                    >
                        <AccountsBox />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workflow;