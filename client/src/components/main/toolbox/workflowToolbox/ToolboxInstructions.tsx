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
    if (flow) {
      const isOffChainFlow = typeof flow === 'string' && flow === 'off-chain';
      const draggedData = {
        category: isOffChainFlow ? 'offChain' : 'onChain',
        nodes: isOffChainFlow && nodeDefinition ? [nodeDefinition] : (flow.nodes || []),
        edges: isOffChainFlow ? [] : (flow.edges || []),
        code: isOffChainFlow ? undefined : flow.code
      };
      
      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify(draggedData)
      );
      event.dataTransfer.effectAllowed = "move";
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
      className="w-full mx-1 my-0.5 px-3 py-1.5 text-sm transition-all duration-200 rounded-lg cursor-grab active:cursor-grabbing group backdrop-blur-sm border border-sidebar-border hover:border-primary"
      style={{
        backgroundColor: isDragging 
          ? 'var(--sidebar-accent)'
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
              className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full border bg-sidebar-accent/20 text-primary border-sidebar-border"
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
            className="p-0.5 rounded transition-all duration-200 text-muted-foreground hover:text-primary hover:bg-sidebar-accent/10"
          >
            <Star className={`h-2.5 w-2.5 ${isFavorite ? "fill-current" : ""}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAdd}
            className="p-0.5 rounded transition-all duration-200 text-muted-foreground hover:text-primary hover:bg-sidebar-accent/10"
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
          className="mt-2 text-xs text-muted-foreground pl-4 border-l border-sidebar-border bg-sidebar-accent/10 rounded-r-lg p-2"
        >
          {description}
        </MotionDiv>
      )}
    </MotionDiv>
  );
}

export const ToolboxInstructions = () => {
  return (
    <div className="p-4 space-y-6 bg-sidebar-accent/10">
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
            <div className="flex-1 h-px bg-sidebar-border" />
            <span className="text-xs text-muted-foreground bg-sidebar-accent px-2 py-1 rounded-full border border-sidebar-border">
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
