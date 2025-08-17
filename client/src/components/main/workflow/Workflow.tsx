import React, {  useCallback, useMemo, useEffect, useContext } from 'react';

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

import { handleDrop } from '@/utils/tabs/workflow/onDrop';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlusIcon } from 'lucide-react';

// Separate component that uses the useReactFlow hook
interface ReactFlowContentProps {
    projectState: any;
    setProjectState: React.Dispatch<React.SetStateAction<any>>;
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
          setProjectState((prev: any) => ({
            ...prev,
            nodes: applyNodeChanges(changes, prev.nodes),
          }));
        },
        [setProjectState]
    );
      
    const onEdgesChange = useCallback(
        (changes: any) => {
          setProjectState((prev: any) => ({
            ...prev,
            edges: applyEdgeChanges(changes, prev.edges),
          }));
        },
        [setProjectState]
    );

    const onConnect = useCallback(
      (connection: any) =>
        setProjectState((prev: any) => ({
          ...prev,
          edges: addEdge(connection, prev.edges),
        })),
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

    const onNodeClick = useCallback((event: any, node: any) => {
        if (node.type === 'instructionGroupNode') {
            // setActiveInstructionId((prevId) => (prevId === node.id ? null : node.id));
        }
    }, []);

    function handleClearCanvas() {
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
        <ReactFlow 
            nodes={projectState.nodes} 
            edges={projectState.edges} 
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', 
                border: 'none!important',
                position: 'relative',
            }}
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
                style: { stroke: '#98b5ff', strokeWidth: 2 },
                type: 'default'
            }}
        >
            <Controls 
                className="reactflow-dark-controls backdrop-blur-xl"
                position="top-left" 
                orientation="horizontal"
                style={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.3)',
                    color: '#94a3b8', 
                    zIndex: 9999,
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    padding: '12px',
                    gap: '12px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                }} 
            >
                <ControlButton 
                    onClick={handleClearCanvas} 
                    title="Clear Canvas"
                    style={{ 
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        color: '#94a3b8',
                        borderRadius: '8px',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        transition: 'all 0.2s ease',
                    }}
                    className="hover:bg-white/10 hover:scale-105 transition-all duration-200"
                >
                    🗑
                </ControlButton>
                <ControlButton 
                    onClick={toggleAccountsBox}
                    title="Toggle Accounts"
                    style={{  
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        color: '#94a3b8',
                        borderRadius: '8px',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        transition: 'all 0.2s ease',
                    }}
                    className="hover:bg-white/10 hover:scale-105 transition-all duration-200"
                >
                    🗃
                </ControlButton>
            </Controls>
        </ReactFlow>
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
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-4 shadow-2xl">
                            <PlusIcon className="w-6 h-6 text-[#4d7cfe]" />
                        </div>
                        <h3 className="text-lg font-medium mb-2 text-gray-300">Start Building Your Workflow</h3>
                        <p className="text-gray-500 max-w-md text-sm">
                            Drag instructions from the sidebar to create your Solana workflow. Connect components to define your program logic.
                        </p>
                    </div>
                </div>
            )}

            {/* AccountsBox Panel */}
            {uxOpenPanel === 'accountsBox' && (
                <div className="absolute top-14 right-6 z-50">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-2xl">
                        <AccountsBox />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workflow;