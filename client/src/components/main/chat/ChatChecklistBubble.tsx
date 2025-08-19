"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { Progress } from "../../../components/ui/progress";
import { useChecklistProgress } from "../../../hooks/useChecklistProgress";
import CodeSnippet from "../code/markdown/CodeSnippet";

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
                <Check className="h-4 w-4 text-green-500" />
              )}
              {step.status === "error" && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              {step.status === "pending" && (
                <div className="h-4 w-4 border-2 border-gray-600 rounded-full" />
              )}
              {step.status === "active" && (
                <div className="h-4 w-4 animate-pulse bg-cyan-500 rounded-full" />
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
              {step.codeSnippet.filename && (
                <div className="text-[10px] text-gray-500 mb-1 font-mono">
                  📄 {step.codeSnippet.filename}
                </div>
              )}
              <div className="text-[10px]">
                <CodeSnippet enableTypewriter={step.status === "active"}>
                  {step.codeSnippet.content}
                </CodeSnippet>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
} 