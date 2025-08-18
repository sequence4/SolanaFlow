import React from "react";
import { DragEvent } from 'react';
import type { ReactFlowInstance, Node, Edge } from '@xyflow/react';
import { InstructionType, ProjectStateType, ProjectContextType } from "@/context/project/ProjectContextTypes";
import { UxOpenPanel } from "@/context/ux/UxContextTypes";
import { duplicateFlowNodesAndEdges } from "./dropUtils";
import { handleOnChainNodeOverrides } from "./handleOnChain";
import { handleOffChainNodeOverrides } from "./handleOffChain";
import { codeInjection } from "@/utils/files/codeInjection";
import { NodeType } from "@/data/nodes/registryManager";

function isOnChainData(draggedData: any): boolean {
  if (draggedData.category === 'onChain') return true;
  if (draggedData.category === 'offChain') return false;
  
  const offChainNodeTypes = ["createNftNode", "metaplexNode", "uploadMetadataNode", "mintNftNode"];
  
  if (draggedData.nodes.some((node: any) => offChainNodeTypes.includes(node.type))) return false;
  
  return true;
}

export async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    setUxOpenPanel: React.Dispatch<React.SetStateAction<UxOpenPanel>>,
    setProjectState: React.Dispatch<React.SetStateAction<ProjectStateType>>,
    maxInstructions = 20,
    walletPubkey?: string,
    projectId?: string,
    setProjectContext?: React.Dispatch<React.SetStateAction<ProjectContextType>>,
    reactFlow?: ReactFlowInstance<Node, Edge>
) {
    event.preventDefault();

    console.log("🎯 Drop event received");
    const rawData = event.dataTransfer.getData("application/reactflow");
    console.log("📄 Raw drop data:", rawData);
    
    const draggedData: { nodes: any[]; code?: any; category?: string } = JSON.parse(rawData);
    console.log("📦 Parsed drag data:", draggedData);
    
    if (!Array.isArray(draggedData.nodes) || draggedData.nodes.length === 0) {
        console.error("❌ No valid nodes found in drag data");
        return;
    }

    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    
    const pointerX = event.clientX - reactFlowBounds.left;
    const pointerY = event.clientY - reactFlowBounds.top;

    let dropPosition;
    if (reactFlow) {
        dropPosition = reactFlow.screenToFlowPosition({ x: pointerX, y: pointerY });
        console.log("Using ReactFlow screenToFlowPosition - Drop position:", dropPosition);
    } else {
        dropPosition = { x: pointerX, y: pointerY };
        console.log("Using direct coordinates - Drop position:", dropPosition);
    }

    let { newNodes, newEdges } = duplicateFlowNodesAndEdges(draggedData, dropPosition.x, dropPosition.y);
    console.log("🔧 New nodes generated:", newNodes);
    console.log("🔗 New edges generated:", newEdges);
    
    // Additional debug for rich instruction data
    newNodes.forEach((node, index) => {
        if (node.type === "instructionGroupNode") {
            console.log(`📋 Rich data for node ${index}:`, {
                id: node.id,
                label: node.data?.label,
                description: node.data?.description,
                accountsCount: node.data?.accounts?.length || 0,
                parametersCount: node.data?.parameters?.length || 0,
                errorCodesCount: node.data?.errorCodes?.length || 0,
                eventsCount: node.data?.events?.length || 0,
                hasCode: !!node.data?.code,
                hasUi: !!node.data?.ui
            });
        }
    });

    const isOnChain = isOnChainData(draggedData);
    console.log("⛓️ Is node on-chain:", isOnChain);
    console.log("🆔 Project ID for injection:", projectId);

    if (isOnChain) newNodes = handleOnChainNodeOverrides(newNodes, walletPubkey);
    else newNodes = handleOffChainNodeOverrides(newNodes, walletPubkey);

    setProjectState((prev) => {
        console.log("💾 setProjectState called - Previous state:", prev);
        
        const currentInstructionCount = (prev.nodes || []).filter((n: any) => n.type === "instructionGroupNode").length;
        const incomingInstructionCount = newNodes.filter((n: any) => n.type === "instructionGroupNode").length;
        
        console.log(`📊 Current instruction count: ${currentInstructionCount}, incoming: ${incomingInstructionCount}`);

        if (currentInstructionCount + incomingInstructionCount > maxInstructions) {
            console.error(`❌ Maximum of ${maxInstructions} instructions exceeded`);
            alert(`Maximum of ${maxInstructions} instructions allowed`);
            return prev;
        }

        const newInstructions: InstructionType[] = newNodes
            .filter((node: any) => node.type === "instructionGroupNode")
            .map((node: any) => ({
                label: node.data?.label ?? "Untitled",
                context: node.data?.context ?? [],
                inputs: node.data?.inputs ?? [],
                outputs: node.data?.outputs ?? [],
                code: node.data?.code ?? "",
            }));

        console.log("📝 New instructions created:", newInstructions);

        const newState = {
            ...prev,
            nodes: [...(prev.nodes || []), ...newNodes],
            edges: [...(prev.edges || []), ...newEdges],
            instructions: [...(prev.instructions ?? []), ...newInstructions],
            projectFiles: {
                lib: draggedData.code?.lib ?? prev.projectFiles?.lib ?? "",
                mod: draggedData.code?.mod ?? prev.projectFiles?.mod ?? "",
                state: draggedData.code?.state ?? prev.projectFiles?.state ?? "",
            },
        };
        
        console.log("✅ New project state:", newState);
        console.log(`🎯 Total nodes after update: ${newState.nodes.length}`);
        
        return newState;
    });
    
    if (!isOnChain && projectId) {
        const processedNodeTypes = new Set<string>();
        const injectionPromises = [];
        
        for (const node of newNodes) {            
            if (processedNodeTypes.has(node.type)) {
                console.log(`Node type ${node.type} already processed, skipping`);
                continue;
            }
            
            processedNodeTypes.add(node.type);
            try {
                const injectionPromise = codeInjection.injectNodeCode(projectId, node.type as NodeType, setProjectContext);
                injectionPromises.push(injectionPromise);
            } catch (error) { console.error(`Failed to inject code for ${node.type}:`, error); }
        }
        
        try {
            await Promise.all(injectionPromises);
            console.log("All code injections completed");
        } catch (error) { console.error("Error during code injection:", error); }
    } else if (!isOnChain) { console.log("No projectId provided, skipping code injection"); }
    return { newNodes, newEdges };
}