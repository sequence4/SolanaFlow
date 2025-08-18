"use client";

import React, { useContext } from "react";
import UxContext from "@/context/ux/UxContext";
import '@/styles/header/modern-header.css';
import FileContext from "@/context/file/FileContext";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import type { FileTreeItemType } from "@/interfaces/FileTreeItemType";

// shadcn UI components
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Header() {
  const { activeTab } = useContext(UxContext);
  const { fileTree } = useContext(FileContext);
  const { isBuilding } = useTaskLogs();

  /**
   * Returns true if *any* node in the supplied tree is a file.
   * A node is considered a file when it has **no `children` array**
   * (covers generators that omit a `type` flag entirely).
   */
  const nodeHasFile = (n: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(n)
      ? n.some(nodeHasFile)                    // iterate over array roots
      : n.children && n.children.length > 0    // directory ➜ drill down
        ? n.children.some(nodeHasFile)
        : true;                                // leaf  ➜ treat as file

  const hasFiles = fileTree ? nodeHasFile(fileTree) : false;

  return (
    <TabsList className="tab-list-modern bg-[var(--foreground-dark)] p-2 pb-4 flex gap-2">
      <TabsTrigger
        value="workflow"
        className={`tab-trigger cursor-pointer ${activeTab === "workflow" ? "tab-active" : "tab-inactive"}`}
      >
        workflow
      </TabsTrigger>
      <TabsTrigger
        value="interface"
        className={`tab-trigger ${(!hasFiles || isBuilding) ? "cursor-not-allowed" : "cursor-pointer"} ${activeTab === "interface" ? "tab-active animate-pulse" : "tab-inactive"}`}
        disabled={!hasFiles || isBuilding}
      >
        interface
      </TabsTrigger>
      <TabsTrigger
        value="code"
        /* visually muted while building, but NOT disabled */
        className={`tab-trigger ${(!hasFiles || isBuilding) ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${activeTab === "code" ? "tab-active" : "tab-inactive"}`}
      >
        code
      </TabsTrigger>
    </TabsList>
  );
}
