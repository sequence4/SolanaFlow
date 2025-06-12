"use client";

import React, { useContext } from "react";
import UxContext from "@/context/ux/UxContext";
import FileContext from "@/context/file/FileContext";
import { useTaskLogs } from "@/context/logs/useTaskLogs";

// shadcn UI components
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Header() {
  const { activeTab } = useContext(UxContext);
  const { fileTree } = useContext(FileContext);
  const { isBuilding } = useTaskLogs();

  // Check if there are any files in the fileTree
  const hasFiles =
    Array.isArray(fileTree) ? fileTree.length > 0 : !!fileTree;

  return (
    <TabsList className="bg-[var(--foreground-dark)] p-2 pb-4 flex gap-2">
      <TabsTrigger
        value="workflow"
        className={`cursor-pointer ${activeTab === "workflow" ? "tab-active" : "tab-inactive"}`}
      >
        workflow
      </TabsTrigger>
      <TabsTrigger
        value="interface"
        className={`${(!hasFiles || isBuilding) ? "cursor-not-allowed" : "cursor-pointer"} ${activeTab === "interface" ? "tab-active" : "tab-inactive"}`}
        disabled={!hasFiles || isBuilding}
      >
        interface
      </TabsTrigger>
      <TabsTrigger
        value="code"
        className={`${(!hasFiles || isBuilding) ? "cursor-not-allowed" : "cursor-pointer"} ${activeTab === "code" ? "tab-active" : "tab-inactive"}`}
        disabled={!hasFiles || isBuilding}
      >
        code
      </TabsTrigger>
    </TabsList>
  );
}
