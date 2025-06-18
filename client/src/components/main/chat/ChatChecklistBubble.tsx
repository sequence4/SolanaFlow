"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { Progress } from "../../../components/ui/progress";
import { useChecklistProgress } from "../../../hooks/useChecklistProgress";

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
            {step.status !== "pending" && (
              <span className="text-[10px] text-gray-400 uppercase">
                {step.status === "done" ? "100%" : step.status === "active" ? "…" : ""}
              </span>
            )}
          </div>

          <Progress
            value={
              step.status === "done"   ? 100 :
              step.status === "active" ? 50  : 0
            }
          />

          {step.description && (
            <p className="mt-2 text-[11px] text-gray-400">
              {step.description}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
} 