"use client";

import React, { useContext, useEffect } from 'react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
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

  const treeHasFile = (n: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(n)
      ? n.some(treeHasFile)       
      : n.children && n.children.length > 0 
        ? n.children.some(treeHasFile)
        : true;                       

  const hasFiles = fileTree ? treeHasFile(fileTree) : false;

  useEffect(() => {
    if (!hasFiles && (activeTab === 'interface' || activeTab === 'code')) {
      setActiveTab('workflow');
    }
  }, [hasFiles, activeTab, setActiveTab]);

  return (
    <>
      <Header />
      
      <div className="main-page-content main-page-layout flex flex-1 overflow-hidden bg-background">        
        <Toolbox />
        <div className="main-content-area flex-1 min-w-0">
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
        <RightPanel />
      </div>
    </>
  );
}