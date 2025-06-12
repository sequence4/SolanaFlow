"use client";

import React, { useContext } from "react";
import UxContext from "@/context/ux/UxContext";
import FileContext from "@/context/file/FileContext";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import type { FileTreeItemType } from "@/interfaces/FileTreeItemType";

// shadcn UI components
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Header() {
  const { activeTab } = useContext(UxContext);
  const { fileTree } = useContext(FileContext);
  const { isBuilding } = useTaskLogs();

  /* Recursively check if there are any files in the tree */
  const treeHasAFile = (node: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(node)
      ? node.some(treeHasAFile)
      : node.type === 'file'
        ? true
        : node.children?.some(treeHasAFile) ?? false;

  const hasFiles = fileTree ? treeHasAFile(fileTree) : false;

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
