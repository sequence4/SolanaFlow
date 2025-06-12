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
