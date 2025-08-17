import React, { useRef, useState } from 'react';
import { useColorModeValue } from '../../../ui/color-mode';
import { motion } from 'framer-motion';
import { groupedInstructions } from '../../../../data/toolbox/instructionItems'; 
import { Star, PlusCircle } from 'lucide-react';

const MotionDiv = motion.div;

interface InstructionCardProps {
  key: string;
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
        boxShadow: "0 4px 20px rgba(77, 124, 254, 0.15)",
        backgroundColor: "rgba(30, 41, 59, 0.3)"
      }}
      whileDrag={{ 
        scale: 1.05,
        opacity: 0.8,
        boxShadow: "0 10px 30px rgba(77, 124, 254, 0.3)",
        zIndex: 1000
      }}
      className={`w-full mx-2 my-1 px-4 py-3 text-sm transition-all duration-200 rounded-lg cursor-grab active:cursor-grabbing group backdrop-blur-sm ${
        isDragging 
          ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/50 shadow-lg shadow-blue-500/25" 
          : isHovered 
            ? "bg-white/5 border border-white/10" 
            : "bg-transparent border border-transparent hover:border-white/5"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={handleDragStart as any}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <MotionDiv
            animate={isDragging ? { scale: [1, 1.2, 1], rotate: [0, 180, 360] } : {}}
            transition={{ duration: 0.6, repeat: isDragging ? Infinity : 0 }}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mr-3 shadow-lg shadow-blue-500/50"
          />
          <span className={`font-medium transition-colors duration-200 ${isHovered || isDragging ? "text-white" : "text-slate-300"}`}>
            {name}
          </span>
          {isNew && (
            <MotionDiv
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              className="ml-2 text-xs px-2 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30"
            >
              New
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
            className={`p-1.5 rounded-lg backdrop-blur-sm transition-all duration-200 ${
              isFavorite 
                ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" 
                : "text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <Star className={`h-3 w-3 ${isFavorite ? "fill-current" : ""}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAdd}
            className="p-1.5 rounded-lg backdrop-blur-sm text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-200"
          >
            <PlusCircle className="h-3 w-3" />
          </motion.button>
        </MotionDiv>
      </div>

      {description && isHovered && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 text-xs text-slate-400 pl-4 border-l border-gradient-to-b from-blue-500/50 to-purple-500/50 bg-black/10 rounded-r-lg p-2"
        >
          {description}
        </MotionDiv>
      )}
    </MotionDiv>
  );
}

export const ToolboxInstructions = () => {
  return (
    <div className="p-4 space-y-6">
      {groupedInstructions.map((group, groupIndex) => (
        <MotionDiv
          key={group.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
            <h3 className="font-semibold text-white text-sm tracking-wide">
              {group.label}
            </h3>
            <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
            <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-full">
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
