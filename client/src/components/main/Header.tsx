"use client";

import React, { useContext } from "react";
import UxContext from "@/context/ux/UxContext";
import FileContext from "@/context/file/FileContext";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import type { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Header() {
  const { activeTab } = useContext(UxContext);
  const { fileTree } = useContext(FileContext);
  const { isBuilding } = useTaskLogs();

  const nodeHasFile = (n: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(n)
      ? n.some(nodeHasFile)
      : n.children && n.children.length > 0
        ? n.children.some(nodeHasFile)
        : true;

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
        className={`tab-trigger ${(!hasFiles || isBuilding) ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${activeTab === "code" ? "tab-active" : "tab-inactive"}`}
      >
        code
      </TabsTrigger>
    </TabsList>
  );
}
