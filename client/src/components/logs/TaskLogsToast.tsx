"use client";

import React from "react";
import { Loader2, Server, Database, Code, Cpu, HardDrive, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import { STAGES } from "@/context/logs/TaskLogsProvider";

const iconMap: Record<string, React.ReactNode> = {
  Server: <Server className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
  Code: <Code className="h-4 w-4" />,
  Cpu: <Cpu className="h-4 w-4" />,
  HardDrive: <HardDrive className="h-4 w-4" />,
  CheckCircle: <Check className="h-4 w-4 text-green-500" />,
};

export default function TaskLogsToast() {
  const {
    isVisible,
    currentStep,
    showDetails,
    setShowDetails,
    systemLogs,
  } = useTaskLogs();

  if (!isVisible) return null;

  const safeStep = currentStep; // Don't clamp negative values
  const progress = safeStep < 0 ? 0 : ((safeStep + 1) / STAGES.length) * 100;
  
  const renderedRows = STAGES.map((s, i) => ({
    ...s,
    status: i < safeStep ? "done"
          : i === safeStep ? "active"
          : "todo"
  }));

  return (
    <div className="z-1000 fixed bottom-0 right-120 w-96 bg-[#0A0B10]/95 border border-[#1A1B25] rounded-lg shadow-xl backdrop-blur-sm overflow-hidden">
      
      {/* Header */}
      <div className="relative h-12 bg-gradient-to-r from-[#0E0F17] to-[#151823] flex items-center px-4">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-8 h-8 border border-white/20"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: "rotate(45deg)",
              }}
            />
          ))}
        </div>
        <div className="flex items-center space-x-2 z-10">
          <div className="h-6 w-6 rounded-full bg-[#0A0B10] flex items-center justify-center">
            {progress === 100 ? (
                <Check className="h-4 w-4 text-green-500" />
            ) : (
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            )}
          </div>
          <h3 className="font-medium text-sm">
            {safeStep < 0 ? "Waiting for pipeline..." :
             progress === 100 || safeStep >= STAGES.length ? "Completed" : 
             STAGES[safeStep].label}
          </h3>
        </div>
        <div className="ml-auto flex items-center space-x-1 z-10">
          <div className="text-xs font-mono text-blue-300">{Math.round(progress)}%</div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(systemLogs.join("\n"))}
            className="ml-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Copy log
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-[#1A1B25]">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="p-4">

        {/* Status logs */}
        <div className="space-y-2 mb-3">
          {renderedRows.map((row) => (
            <div
              key={row.stage}
              className={cn(
                "flex items-start gap-3 py-1.5 px-2 rounded transition-colors",
                row.status === "active" ? "bg-[#0E1018]/80" : "",
                row.status !== "todo" ? "text-gray-300" : "text-gray-500",
              )}
            >
              <div className="mt-0.5">
                {row.status === "done" && <Check className="h-4 w-4 text-green-500" />}
                {row.status === "active" && (
                  <div className="h-4 w-4 flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  </div>
                )}
                {row.status === "todo" && (
                  <div className="h-4 w-4 rounded-full border border-gray-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-xs font-medium">{row.label}</span>
                </div>

                {showDetails && row.status !== "todo" && (
                  <div className="mt-1 text-xs text-gray-500 pl-6">
                    {systemLogs.find(l => l.includes(row.stage)) ?? row.stage}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with technical stats */}
        {/*}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs border-t border-[#1A1B25] pt-3">
          <div>
            <div className="text-gray-500">Memory</div>
            <div className="font-mono text-gray-300">{memoryStats}</div>
          </div>
          <div>
            <div className="text-gray-500">Network</div>
            <div className="font-mono text-gray-300">{networkStats}</div>
          </div>
          <div>
            <div className="text-gray-500">Node</div>
            <div className="font-mono text-gray-300">{nodeVersion}</div>
          </div>
        </div>
        */}
      </div>
    </div>
  );
} 