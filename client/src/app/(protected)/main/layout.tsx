"use client";

import React from "react"
import { Header } from "@/components/header"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { InstructionsPanel } from "@/components/instructions-panel"
import { RightPanel } from "@/components/right-panel"
import TaskLogsToast from "@/components/logs/TaskLogsToast";
import useInitializeTaskLogger from "@/data/hooks/useInitializeTaskLogger";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useInitializeTaskLogger();
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex">
          <WorkflowCanvas />
          <InstructionsPanel />
        </main>

        <RightPanel />
        <TaskLogsToast />
      </div>
    </div>
  )
}
