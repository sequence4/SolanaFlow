import React from 'react';
import { InstructionGroupNode } from './InstructionNode';
import { EnhancedInstructionNode } from './EnhancedInstructionNode';
import { convertLegacyToEnhanced } from '@/utils/enhancedNodeConverter';
import { EnhancedInstructionNodeData } from '@/types/EnhancedInstructionTypes';

// Type guard to check if data is already enhanced
function isEnhancedData(data: any): data is EnhancedInstructionNodeData {
  return data && typeof data.programId === 'string' && typeof data.category === 'string';
}

interface InstructionNodeWrapperProps {
  data: any;
  useEnhanced?: boolean;
}

export const InstructionNodeWrapper: React.FC<InstructionNodeWrapperProps> = ({ 
  data, 
  useEnhanced = false 
}) => {
  // If we should use enhanced and data is not already enhanced, convert it
  if (useEnhanced) {
    const enhancedData = isEnhancedData(data) ? data : convertLegacyToEnhanced(data);
    return <EnhancedInstructionNode data={enhancedData} />;
  }
  
  // Otherwise use legacy component
  return <InstructionGroupNode data={data} />;
};