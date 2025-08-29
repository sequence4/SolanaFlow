import { nanoid } from "nanoid";

export function duplicateFlowNodesAndEdges(
  draggedData: any,
  dropX: number,
  dropY: number
) {
  console.log("🔄 duplicateFlowNodesAndEdges called with:", { draggedData, dropX, dropY });
  console.log("📊 Input nodes:", draggedData.nodes);
  console.log("🔗 Input edges:", draggedData.edges);
  
  const nodeIdMap: Record<string, string> = {};
  draggedData.nodes.forEach((node: any) => {
    nodeIdMap[node.id] = `${node.type}-${nanoid(6)}`;
  });

  const newNodes = draggedData.nodes.map((node: any) => {
    const newNodeId = nodeIdMap[node.id];
    const newPosition = {
      x: node.position.x + dropX,
      y: node.position.y + dropY,
    };

    const newNode = {
      ...node,
      id: newNodeId,
      position: newPosition,
    };
    
    console.log(`🎯 Generated node: ${newNode.id} at position (${newPosition.x}, ${newPosition.y})`);
    console.log("📋 Node data:", newNode.data);
    
    return newNode;
  });

  const newEdges = (draggedData.edges || []).map((edge: any) => ({
    ...edge,
    id: `edge-${nanoid(6)}`,
    source: nodeIdMap[edge.source] || edge.source,
    target: nodeIdMap[edge.target] || edge.target,
  }));

  console.log("✅ Final generated nodes:", newNodes);
  console.log("✅ Final generated edges:", newEdges);

  return { newNodes, newEdges, nodeIdMap };
}

export function validateDecimals(input: string, fallback = 9, min = 0, max = 9) {
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
} 