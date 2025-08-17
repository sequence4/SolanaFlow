"use client";

import React, { useContext, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import Workflow from "@/components/main/workflow/Workflow";
import Interface from "@/components/main/interface/Interface";
import Code from "@/components/main/code/Code";
import { RightPanel } from "@/components/right-panel";
import { Toolbox } from "@/components/main/toolbox/Toolbox";
import UxContext from "@/context/ux/UxContext";
import FileContext from "@/context/file/FileContext";
import { ActiveTab } from "@/context/ux/UxContextTypes";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";

export default function MainPage() {
  const { activeTab, setActiveTab } = useContext(UxContext);
  const { fileTree } = useContext(FileContext);

  /**
   * Returns true if any node in the tree is a file.
   * A node is considered a file when it has **no children array**
   * (covers arrays, single-root objects, and generators that omit `type: "file"`).
   */
  const treeHasFile = (n: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(n)
      ? n.some(treeHasFile)                     // iterate over array roots
      : n.children && n.children.length > 0     // directory ➜ drill down
        ? n.children.some(treeHasFile)
        : true;                                 // leaf ➜ treat as file

  const hasFiles = fileTree ? treeHasFile(fileTree) : false;

  useEffect(() => {
    if (!hasFiles && (activeTab === 'interface' || activeTab === 'code')) {
      setActiveTab('workflow');
    }
  }, [hasFiles, activeTab, setActiveTab]);

  return (
    <>
      <Header />
      
      <div className="flex flex-1 overflow-hidden">        
        <div className="flex-1">
          <Tabs 
            value={activeTab}
            onValueChange={(value) => {
              if ((value === 'interface' || value === 'code') && !hasFiles) {
                return;
              }
              setActiveTab(value as ActiveTab);
            }}
            className="h-full w-full flex flex-col"
          >
            <div className="flex items-center justify-start w-full">
              <TabsList className="mx-4 my-2 px-1 bg-card/95 backdrop-blur-sm border border-border rounded-lg">
                <TabsTrigger
                  value="workflow"
                  className="
                    data-[state=active]:bg-primary
                    data-[state=active]:text-primary-foreground
                    px-3 py-1 text-sm font-medium
                    hover:bg-accent
                    rounded-md
                    cursor-pointer
                    transition-all
                  "
                >
                  workflow
                </TabsTrigger>

                <TabsTrigger
                  value="interface"
                  disabled={!hasFiles}
                  className="
                    data-[state=active]:bg-primary
                    data-[state=active]:text-primary-foreground
                    px-3 py-1 text-sm font-medium
                    hover:bg-accent
                    rounded-md
                    cursor-pointer
                    transition-all
                    disabled:opacity-50
                  "
                >
                  interface
                </TabsTrigger>

                <TabsTrigger
                  value="code"
                  disabled={!hasFiles}
                  className="
                    data-[state=active]:bg-primary
                    data-[state=active]:text-primary-foreground
                    px-3 py-1 text-sm font-medium
                    hover:bg-accent
                    rounded-md
                    cursor-pointer
                    transition-all
                    disabled:opacity-50
                  "
                >
                  code
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="workflow" className="flex-1 h-full overflow-auto">
              <Workflow />
            </TabsContent>

            <TabsContent value="interface" className="flex-1 h-full overflow-auto">
              <Interface />
            </TabsContent>

            <TabsContent value="code" className="flex-1 h-full overflow-auto">
              <Code />
            </TabsContent>
          </Tabs>
        </div>
        
        <Toolbox />
        <RightPanel />
      </div>
    </>
  );
}