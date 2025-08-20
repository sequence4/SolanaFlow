"use client";
import { motion } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { Progress } from "../../../components/ui/progress";
import { useChecklistProgress } from "../../../hooks/useChecklistProgress";
import CompactCodeSnippet from "../code/markdown/CompactCodeSnippet";
import SequentialCodeDisplay from "./SequentialCodeDisplay";

export default function ChatChecklistBubble() {
  const steps = useChecklistProgress();
  
  // Find current step to hide future ones
  const currentStepIndex = steps.findIndex(step => step.status === 'active');
  const lastCompletedIndex = steps.reduce((lastIdx, step, idx) => 
    step.status === 'done' ? idx : lastIdx, -1);
  const visibleSteps = steps.slice(0, Math.max(currentStepIndex + 1, lastCompletedIndex + 2));

  return (
    <div className="checklist-flow space-y-1">
      {visibleSteps.map((step, index) => (
        <div key={step.id} className="relative">
          {/* Only show connecting line if not the last visible step */}
          {index < visibleSteps.length - 1 && (
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
                {step.status === "done" && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center h-4 w-4 bg-green-500 rounded-full"
                  >
                    <Check className="h-2.5 w-2.5 text-white" />
                  </motion.div>
                )}
                {step.status === "error" && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center h-4 w-4 bg-red-500 rounded-full"
                  >
                    <AlertTriangle className="h-2.5 w-2.5 text-white" />
                  </motion.div>
                )}
                {step.status === "pending" && (
                  <div className="h-4 w-4 border-2 border-gray-600/50 rounded-full" />
                )}
                {step.status === "active" && (
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-4 w-4 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50"
                  />
                )}
                <span className="text-sm font-medium text-gray-300">{step.title}</span>
              </div>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
                {step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0)}%
              </span>
            </div>

            <div className="mb-2">
              <Progress 
                value={step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0)} 
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

            {/* Show generated files for Code Generation step when active/completed */}
            {step.stage === "code-gen" && step.generatedFiles && step.generatedFiles.length > 0 && (step.status === "active" || step.status === "done") && (
              <div className="mt-3">
                <SequentialCodeDisplay files={step.generatedFiles} />
              </div>
            )}

          </motion.div>
        </div>
      ))}
    </div>
  );
} 