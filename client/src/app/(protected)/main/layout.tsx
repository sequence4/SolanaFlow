"use client";

import React from "react"
import TaskLogsToast from "@/components/logs/TaskLogsToast";
import useInitializeTaskLogger from "@/data/hooks/useInitializeTaskLogger";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useInitializeTaskLogger();
  
  return (
    <div className="main-layout-wrapper h-screen flex flex-col bg-background text-foreground">
      {children}
      <TaskLogsToast />
    </div>
  )
}
