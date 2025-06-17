"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import FileContext from "./FileContext";
import { FileContextType } from "./FileContextTypes";
import { FileTreeItemType } from "../../interfaces/FileTreeItemType";
import eventBus from "../../lib/eventBus";
import UxContext from "../ux/UxContext";

// Helper function to parse the stored file tree
function getInitialFileTree(): FileTreeItemType | FileTreeItemType[] | null {
  try {
    const stored = localStorage.getItem("fileTree");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn("Could not parse fileTree from localStorage:", error);
    return null;
  }
}

// Helper to parse the stored selected file
function getInitialSelectedFile(): FileTreeItemType | null {
  try {
    const stored = localStorage.getItem("selectedFile");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn("Could not parse selectedFile from localStorage:", error);
    return null;
  }
}

// Helper function to merge a newly written file into the existing tree
const mergeIntoTree = (tree: FileTreeItemType | FileTreeItemType[] | null, item: FileTreeItemType): FileTreeItemType | FileTreeItemType[] => {
  if (!tree) return item; // First arrival
  
  // Convert to array for consistent handling
  const treeArray = Array.isArray(tree) ? tree : [tree];
  
  // Helper to recursively merge
  const merge = (nodes: FileTreeItemType[], newItem: FileTreeItemType): boolean => {
    // Extract path components for navigation
    const itemPath = newItem.path || '';
    const pathParts = itemPath.split('/').filter(Boolean);
    
    if (pathParts.length === 0) {
      // This is a root item, check if it already exists
      const existingIndex = nodes.findIndex(n => n.path === newItem.path);
      if (existingIndex >= 0) {
        nodes[existingIndex] = { ...nodes[existingIndex], ...newItem };
        return true;
      }
      nodes.push(newItem);
      return true;
    }
    
    // Find the parent directory
    const dirPath = pathParts.slice(0, -1).join('/');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'directory' && node.path?.endsWith(dirPath)) {
        // Found the parent directory
        if (!node.children) node.children = [];
        
        // Check if the file already exists in this directory
        const fileName = pathParts[pathParts.length - 1];
        const existingIndex = node.children.findIndex(child => 
          child.name === fileName || child.path === newItem.path
        );
        
        if (existingIndex >= 0) {
          // Update existing file
          node.children[existingIndex] = { 
            ...node.children[existingIndex], 
            ...newItem 
          };
        } else {
          // Add new file
          node.children.push(newItem);
        }
        return true;
      }
      
      // Try to descend into children
      if (node.type === 'directory' && node.children) {
        if (merge(node.children, newItem)) return true;
      }
    }
    
    return false;
  };
  
  // Try to merge with existing tree
  if (!merge(treeArray, item)) {
    // If we couldn't find a place to merge, add as a new root item
    treeArray.push(item);
  }
  
  return treeArray;
};

const FileContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with null - no localStorage calls at initialization
  const [selectedFile, setSelectedFile] = useState<FileTreeItemType | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeItemType | FileTreeItemType[] | null>(null);
  const { setActiveTab } = useContext(UxContext);
  // only run the "switch-to-code-tab + first-file-selection" block once
  const firstFileHandled = useRef(false);
  
  // --- NEW refs --------------------------------------------------------------
  const arrivalQueue = useRef<FileTreeItemType[]>([]);
  const typingInProgress = useRef(false);
  const initialRevealDone = useRef(false);

  // Pops the next queued file once CodeEditor signals typing-done
  const showNextQueuedFile = () => {
    if (typingInProgress.current) return;         // still typing current
    if (!arrivalQueue.current.length) return;     // nothing queued
    const next = arrivalQueue.current.shift()!;
    setSelectedFile(next);
  };
  
  // queue used purely for the bottom-ticker ("typing") effect
  const pushFileArrival = (filePath: string) => {
    eventBus.emit("file-arrival", filePath);
  };

  // Load from localStorage after component mounts
  useEffect(() => {
    try {
      // Load fileTree
      const storedFileTree = localStorage.getItem("fileTree");
      if (storedFileTree) {
        setFileTree(JSON.parse(storedFileTree));
      }

      // Load selectedFile
      const storedSelectedFile = localStorage.getItem("selectedFile");
      if (storedSelectedFile) {
        setSelectedFile(JSON.parse(storedSelectedFile));
      }
    } catch (error) {
      console.warn("Could not parse data from localStorage:", error);
    }
  }, []);

  // Save fileTree to localStorage whenever it changes
  useEffect(() => {
    try {
      if (fileTree) {
        localStorage.setItem("fileTree", JSON.stringify(fileTree));
      } else {
        localStorage.removeItem("fileTree");
      }
    } catch (error) {
      console.warn("Error saving fileTree to localStorage:", error);
    }
  }, [fileTree]);

  // Save selectedFile to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedFile) {
        localStorage.setItem("selectedFile", JSON.stringify(selectedFile));
      } else {
        localStorage.removeItem("selectedFile");
      }
    } catch (error) {
      console.warn("Error saving selectedFile to localStorage:", error);
    }
  }, [selectedFile]);

  // Listen for file-tree and individual file events from SSE
  useEffect(() => {
    const typingStartHandler = () => { typingInProgress.current = true; };
    const typingDoneHandler = () => {
      typingInProgress.current = false;
      showNextQueuedFile();

      // if queue now empty → the first-time reveal is finished
      if (!arrivalQueue.current.length && !initialRevealDone.current) {
        initialRevealDone.current = true;
      }
    };
    
    eventBus.on('typing-start', typingStartHandler);
    eventBus.on('typing-done', typingDoneHandler);
    
    const handler = (payload: any) => {
      /* ---- full snapshot -------------------------------- */
      if (payload.fileTree) {
        const tree = structuredClone(payload.fileTree);
        setFileTree(tree);

        if (!firstFileHandled.current) {
          // choose the very first *file* (DFS)
          const pickFirst = (n:any):any =>
            Array.isArray(n)
              ? pickFirst(n[0])
              : n?.type === 'file'
                  ? n
                  : n?.children && n.children.length
                      ? pickFirst(n.children)
                      : null;
          const first = pickFirst(tree);
          if (first) {
            setSelectedFile(first);
            pushFileArrival(first.name);
          }
          setActiveTab('code');            // jump to Code tab
          firstFileHandled.current = true; // never again
        }
        return;
      }

      /* ---- single streamed file ------------------------- */
      if (payload.path && payload.content) {

        // After the first pass, just merge into tree; no auto-display
        if (initialRevealDone.current) {
          setFileTree(prev => mergeIntoTree(prev, {
            name: payload.path.split('/').pop() ?? 'file',
            path: payload.path,
            type: 'file',
            content: payload.content,
          }));
          return;
        }

        const item: FileTreeItemType = {
          name: payload.path.split('/').pop() ?? 'file',
          path: payload.path,
          type: 'file',
          content: payload.content,
        };
        setFileTree(prev => mergeIntoTree(prev, item));
        pushFileArrival(item.name);          // 👈 ticker, unchanged

        // --- NEW:  decide whether to queue or show immediately ------------------
        if (firstFileHandled.current) {
          if (typingInProgress.current) {
            arrivalQueue.current.push(item); // wait your turn
          } else {
            setSelectedFile(item);           // no typing – show now
            typingInProgress.current = true; // CodeEditor will clear it later
          }
        } else {
          // still the very first file
          setSelectedFile(item);
          setActiveTab('code');            // jump to Code tab
          firstFileHandled.current = true;
          typingInProgress.current = true;
        }
      }
    };

    eventBus.on('progress', handler);
    return () => {
      eventBus.off('progress', handler);
      eventBus.off('typing-start', typingStartHandler);
      eventBus.off('typing-done', typingDoneHandler);
    };
  }, [setActiveTab]);

  const contextValue: FileContextType = {
    selectedFile,
    setSelectedFile,
    fileTree,
    setFileTree: (tree) => {
      setFileTree(tree);
    },
  };

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  );
};

export default FileContextProvider;
