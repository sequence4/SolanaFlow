"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { Progress } from "../../../components/ui/progress";
import { useChecklistProgress } from "../../../hooks/useChecklistProgress";
import CodeSnippet from "../code/markdown/CodeSnippet";
import CompactCodeSnippet from "../code/markdown/CompactCodeSnippet";
import FileGenerationQueue from "./FileGenerationQueue";

export default function ChatChecklistBubble() {
  const steps = useChecklistProgress();

  return (
    <div className="space-y-3">
      {steps.map(step => (
        <motion.div
          key={step.id}
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-gray-800 bg-black/40 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {step.status === "done" && (
                <div className="flex items-center justify-center h-4 w-4 bg-green-500 rounded-full">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              {step.status === "error" && (
                <div className="flex items-center justify-center h-4 w-4 bg-red-500 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              {step.status === "pending" && (
                <div className="h-4 w-4 border-2 border-gray-600 rounded-full opacity-50" />
              )}
              {step.status === "active" && (
                <div className="h-4 w-4 bg-cyan-500 rounded-full animate-pulse shadow-lg shadow-cyan-500/50" />
              )}
              <span className="text-xs font-medium">{step.title}</span>
            </div>
            {/* NEW – live percentage */}
            <span className="text-[10px] font-mono text-gray-400">
              {step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0)}%
            </span>
          </div>

          <Progress value={step.pct ?? (step.status === "done" ? 100 : step.status === "active" ? 50 : 0)} />

          {step.description && (
            <p className="mt-2 text-[11px] text-gray-400">
              {step.description}
            </p>
          )}

          {step.codeSnippet && (
            <div className="mt-2">
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

          {step.stage === "code-gen" && step.status === "active" && (
            <div className="mt-3">
              <FileGenerationQueue />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
} 