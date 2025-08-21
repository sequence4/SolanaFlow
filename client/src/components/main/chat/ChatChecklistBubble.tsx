"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "../../../components/ui/progress";
import { useChecklistProgress, Step } from "../../../hooks/useChecklistProgress";
import CompactCodeSnippet from "../code/markdown/CompactCodeSnippet";
import SequentialCodeDisplay from "./SequentialCodeDisplay";
import { debugLogger } from "../../../utils/debugLogger";

interface ChatChecklistBubbleProps {
  key?: string;
}

const ChatChecklistBubble = React.memo(({ key }: ChatChecklistBubbleProps) => {
  const steps = useChecklistProgress();
  
  // Debug logging
  React.useEffect(() => {
    debugLogger.logRender('ChatChecklistBubble', { 
      stepsCount: steps.length, 
      visibleSteps: visibleSteps.length,
      overallProgress 
    });
  });
  
  // Memoize visible steps calculation to prevent unnecessary re-renders
  const visibleSteps = useMemo(() => {
    const currentStepIndex = steps.findIndex(step => step.status === 'active');
    const lastCompletedIndex = steps.reduce((lastIdx, step, idx) => 
      step.status === 'done' ? idx : lastIdx, -1);
    return steps.slice(0, Math.max(currentStepIndex + 1, lastCompletedIndex + 2));
  }, [steps]);
  
  // Memoize overall progress calculation
  const overallProgress = useMemo(() => {
    if (steps.length === 0) return 0;
    
    let totalProgress = 0;
    steps.forEach(step => {
      const stepProgress = step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0);
      totalProgress += stepProgress;
    });
    
    return Math.round(totalProgress / steps.length);
  }, [steps]);
  
  // Early return for empty steps to prevent unnecessary renders
  if (visibleSteps.length === 0) {
    return null;
  }

  return (
    <div className="checklist-flow space-y-1" key={key}>
      {/* Overall progress indicator */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">Deployment Progress</span>
          <span className="text-xs font-mono text-gray-500">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {visibleSteps.map((step, index) => (
        <StepItem key={step.id} step={step} index={index} isLastStep={index === visibleSteps.length - 1} />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to minimize unnecessary re-renders
  return prevProps.key === nextProps.key;
});

// Memoized step component to prevent cascading re-renders
interface StepItemProps {
  step: Step;
  index: number;
  isLastStep: boolean;
}

const StepItem = React.memo(({ step, index, isLastStep }: StepItemProps) => {
  const [expandedFiles, setExpandedFiles] = useState(false);
  
  const stepProgress = useMemo(() => {
    return step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0);
  }, [step.pct, step.status]);

  return (
    <div className="relative">
      {/* Only show connecting line if not the last visible step */}
      {!isLastStep && (
        <div className="connecting-line absolute left-2 top-12 w-0.5 h-8 bg-gray-600/30" />
      )}
      
      <motion.div
        layout
        initial={{ opacity: 0, y: 6, x: -10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="checklist-item border-l-4 border-cyan-500/50 pl-4 py-3 bg-transparent hover:bg-gray-900/20 transition-colors duration-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <StatusIcon status={step.status} />
            <span className="text-sm font-medium text-gray-300">{step.title}</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
            {stepProgress}%
          </span>
        </div>

        <div className="mb-2">
          <Progress 
            value={stepProgress} 
            className="h-1.5"
          />
        </div>

        {step.description && (
          <p className="mb-2 text-xs text-gray-400 leading-relaxed">
            {step.description}
          </p>
        )}

        {step.codeSnippet && (
          <div className="mb-2">
            <CompactCodeSnippet 
              enableTypewriter={step.status === "active"}
              filename={step.codeSnippet.filename}
              language={step.codeSnippet.language}
              lineCount={step.codeSnippet.lineCount}
              typewriterSpeed={1}
            >
              {step.codeSnippet.content}
            </CompactCodeSnippet>
          </div>
        )}

        {/* Enhanced file list display for Code Generation */}
        {step.stage === "code-gen" && step.generatedFiles && step.generatedFiles.length > 0 && step.status === "active" && (
          <div className="mt-3 space-y-2">
            {/* File counter with expand/collapse */}
            <div className="flex items-center justify-between text-xs bg-gray-800/30 rounded px-2 py-1">
              <span className="text-cyan-400 font-medium flex items-center gap-1">
                <span>📁</span>
                Generated Files ({step.generatedFiles.length})
              </span>
              <button
                onClick={() => setExpandedFiles(!expandedFiles)}
                className="text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                {expandedFiles ? (
                  <><ChevronUp size={12} /> Hide</>
                ) : (
                  <><ChevronDown size={12} /> Show all</>
                )}
              </button>
            </div>
            
            {/* File list grid */}
            <div className={`transition-all duration-200 overflow-hidden ${
              !expandedFiles ? 'max-h-16' : 'max-h-48'
            }`}>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {step.generatedFiles.slice(0, expandedFiles ? step.generatedFiles.length : 4).map((file, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-1 text-gray-400 bg-gray-900/40 rounded px-2 py-1 hover:bg-gray-800/40 transition-colors"
                  >
                    <span className="text-cyan-500 flex-shrink-0">
                      {getFileIcon(file.filename)}
                    </span>
                    <span className="truncate text-xs">{file.filename}</span>
                  </motion.div>
                ))}
              </div>
              
              {!expandedFiles && step.generatedFiles.length > 4 && (
                <div className="text-center mt-1">
                  <span className="text-xs text-gray-500">
                    +{step.generatedFiles.length - 4} more files...
                  </span>
                </div>
              )}
            </div>
            
            {/* Code preview - only show latest file in compact form */}
            {step.generatedFiles.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Latest file preview:</div>
                <SequentialCodeDisplay 
                  key={`checklist-code-${step.id}-${step.generatedFiles.length}`}
                  files={[step.generatedFiles[step.generatedFiles.length - 1]]}
                />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Deep comparison for step properties that affect rendering
  return (
    prevProps.step.id === nextProps.step.id &&
    prevProps.step.status === nextProps.step.status &&
    prevProps.step.pct === nextProps.step.pct &&
    prevProps.step.description === nextProps.step.description &&
    prevProps.index === nextProps.index &&
    prevProps.isLastStep === nextProps.isLastStep &&
    prevProps.step.generatedFiles?.length === nextProps.step.generatedFiles?.length
  );
});

// Memoized status icon component
interface StatusIconProps {
  status: Step['status'];
}

const StatusIcon = React.memo(({ status }: StatusIconProps) => {
  switch (status) {
    case "done":
      return (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center h-4 w-4 bg-green-500 rounded-full"
        >
          <Check className="h-2.5 w-2.5 text-white" />
        </motion.div>
      );
    case "error":
      return (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center h-4 w-4 bg-red-500 rounded-full"
        >
          <AlertTriangle className="h-2.5 w-2.5 text-white" />
        </motion.div>
      );
    case "pending":
      return <div className="h-4 w-4 border-2 border-gray-600/50 rounded-full" />;
    case "active":
      return (
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-4 w-4 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50"
        />
      );
    default:
      return <div className="h-4 w-4 border-2 border-gray-600/50 rounded-full" />;
  }
});

// Helper function for file icons
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch(ext) {
    case 'rs': return '🦀';
    case 'toml': return '📋';
    case 'tsx': case 'jsx': return '⚛️';
    case 'ts': case 'js': return '📘';
    case 'json': return '📄';
    case 'md': return '📝';
    case 'css': return '🎨';
    case 'html': return '🌐';
    default: return '📄';
  }
}

ChatChecklistBubble.displayName = 'ChatChecklistBubble';
StepItem.displayName = 'StepItem';
StatusIcon.displayName = 'StatusIcon';

export default ChatChecklistBubble;