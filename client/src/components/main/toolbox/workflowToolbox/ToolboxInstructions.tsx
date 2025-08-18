import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { groupedInstructions } from '../../../../data/toolbox/instructionItems'; 
import { Star, PlusCircle } from 'lucide-react';

const MotionDiv = motion.div;

interface InstructionCardProps {
  name: string;
  icon?: React.ElementType;
  flow?: any;
  nodeDefinition?: any;
  description?: string;
  isNew?: boolean;
  isFavorite?: boolean;
}

export function InstructionCard({ 
  name, 
  icon, 
  flow, 
  nodeDefinition, 
  description, 
  isNew = false,
  isFavorite = false 
}: InstructionCardProps) {
  const IconComponent = icon || null;
  const divRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    
    console.log("🚀 Dragging instruction:", name, "with flow:", flow);
    
    if (flow) {
      // Debug flow object
      console.log("🔍 Flow categorization debug:", {
        name,
        flowType: typeof flow,
        flowValue: flow,
        isString: typeof flow === 'string',
        stringValue: typeof flow === 'string' ? flow : 'not a string'
      });
      
      const isOffChainFlow = typeof flow === 'string' && flow === 'off-chain';
      
      // SPL Token instructions should NEVER be off-chain
      const isSPLTokenInstruction = name.includes('Token') || 
                                    name.includes('Mint') || 
                                    name.includes('Initialize') ||
                                    name.includes('Burn') ||
                                    name.includes('Transfer') ||
                                    name.includes('Approve') ||
                                    name.includes('Freeze') ||
                                    name.includes('Thaw') ||
                                    name.includes('Close') ||
                                    name.includes('Revoke') ||
                                    name.includes('Authority');
      
      // Override: Force SPL token instructions to be onChain
      const actuallyOffChain = isOffChainFlow && !isSPLTokenInstruction;
      
      console.log("🔍 Categorization result:", {
        isOffChainFlow,
        isSPLTokenInstruction,
        actuallyOffChain,
        finalCategory: actuallyOffChain ? 'offChain' : 'onChain'
      });
      
      // Handle missing nodes array - create a fallback node  
      let nodes = flow?.nodes || [];
      if (!actuallyOffChain && (!nodes || nodes.length === 0)) {
        console.warn("⚠️ Creating fallback node for SPL instruction:", name);
        nodes = [{
          id: `${name.toLowerCase().replace(/\s+/g, '-')}-instruction`,
          type: 'instructionGroupNode',
          position: { x: 0, y: 0 },
          data: {
            label: name,
            instruction: name,
            programName: 'SPL Token Program',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            description: `${name} instruction from SPL Token Program`,
            accounts: flow?.accounts || [],
            parameters: flow?.parameters || [],
            errorCodes: flow?.errorCodes || [],
            events: flow?.events || [],
            code: flow?.code || '',
          }
        }];
      }
      
      const draggedData = {
        category: actuallyOffChain ? 'offChain' : 'onChain', // Fixed category
        nodes: actuallyOffChain && nodeDefinition ? [nodeDefinition] : nodes,
        edges: actuallyOffChain ? [] : (flow?.edges || []),
        code: actuallyOffChain ? undefined : flow?.code
      };
      
      console.log("📦 Final drag data:", draggedData);
      console.log("🎯 Nodes count:", draggedData.nodes.length);
      
      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify(draggedData)
      );
      event.dataTransfer.effectAllowed = "move";
    } else {
      console.error("❌ No flow data available for:", name);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Implement favorite toggling logic here
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (divRef.current) {
      const dragEvent = new DragEvent('dragstart', { bubbles: true });
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: new DataTransfer(),
      });
      divRef.current.dispatchEvent(dragEvent);
      handleDragStart(dragEvent as unknown as React.DragEvent<HTMLDivElement>);
    }
  };

  React.useEffect(() => {
    const currentDiv = divRef.current;
    if (currentDiv) {
      currentDiv.addEventListener('dragstart', handleDragStart as any);
      return () => {
        currentDiv.removeEventListener('dragstart', handleDragStart as any);
      };
    }
  }, [flow, nodeDefinition]);

  return (
    <MotionDiv
      ref={divRef}
      draggable
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ 
        scale: 1.02,
        backgroundColor: "var(--sidebar-accent)"
      }}
      whileDrag={{ 
        scale: 1.05,
        opacity: 0.8,
        zIndex: 1000
      }}
      className="w-full mx-1 my-0.5 px-3 py-1.5 text-sm transition-all duration-200 rounded-lg cursor-grab active:cursor-grabbing group backdrop-blur-sm border border-border hover:border-primary"
      style={{
        backgroundColor: isDragging 
          ? 'var(--muted)'
          : 'transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={handleDragStart as any}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <div 
            className="w-1 h-1 rounded-full mr-2 bg-muted-foreground"
          />
          <span 
            className="text-xs font-medium transition-colors duration-200 text-foreground"
          >
            {name}
          </span>
          {isNew && (
            <MotionDiv
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full border bg-muted/20 text-primary border-border"
            >
              NEW
            </MotionDiv>
          )}
        </div>
        <MotionDiv
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 10 }}
          className="flex items-center space-x-1"
        >
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleFavorite}
            className="p-0.5 rounded transition-all duration-200 text-muted-foreground hover:text-primary hover:bg-muted/10"
          >
            <Star className={`h-2.5 w-2.5 ${isFavorite ? "fill-current" : ""}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAdd}
            className="p-0.5 rounded transition-all duration-200 text-muted-foreground hover:text-primary hover:bg-muted/10"
          >
            <PlusCircle className="h-2.5 w-2.5" />
          </motion.button>
        </MotionDiv>
      </div>

      {description && isHovered && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 text-xs text-muted-foreground pl-4 border-l border-border bg-muted/10 rounded-r-lg p-2"
        >
          {description}
        </MotionDiv>
      )}
    </MotionDiv>
  );
}

export const ToolboxInstructions = () => {
  return (
    <div className="p-4 space-y-6 bg-card">
      {groupedInstructions.map((group, groupIndex) => (
        <MotionDiv
          key={group.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h3 className="font-semibold text-foreground text-sm tracking-wide">
              {group.label}
            </h3>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full border border-border">
              {group.items.length}
            </span>
          </div>

          <div className="space-y-1">
            {group.items.map((item, itemIndex) => (
              <MotionDiv
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: (groupIndex * 0.1) + (itemIndex * 0.05) }}
              >
                <InstructionCard
                  key={item.name}
                  name={item.name}
                  flow={item.flow}
                  isNew={itemIndex < 2} // Mark first 2 items as new for demo
                  isFavorite={itemIndex === 0} // Mark first item as favorite for demo
                />
              </MotionDiv>
            ))}
          </div>
        </MotionDiv>
      ))}
    </div>
  );
};
