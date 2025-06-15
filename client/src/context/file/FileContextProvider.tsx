"use client";

import React, { useState, useEffect } from "react";
import FileContext from "./FileContext";
import { FileContextType } from "./FileContextTypes";
import { FileTreeItemType } from "../../interfaces/FileTreeItemType";
import eventBus from "../../lib/eventBus";

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

// Sample default file tree to use when no data is available
const defaultFileTree: FileTreeItemType = {
  name: "Project Files",
  type: "directory",
  path: "root",
  children: [
    {
      name: "src",
      type: "directory",
      path: "root/src",
      children: [
        {
          name: "components",
          type: "directory",
          path: "root/src/components",
          children: [
            {
              name: "App.tsx",
              type: "file",
              path: "root/src/components/App.tsx",
            }
          ]
        },
        {
          name: "index.ts",
          type: "file",
          path: "root/src/index.ts",
        }
      ]
    },
    {
      name: "README.md",
      type: "file",
      path: "root/README.md",
    }
  ]
};

// NEW: Helper to parse the stored selected file
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

  // Load from localStorage after component mounts
  useEffect(() => {
    try {
      // Load fileTree
      const storedFileTree = localStorage.getItem("fileTree");
      if (storedFileTree) {
        setFileTree(JSON.parse(storedFileTree));
      } else {
        // Set default file tree if nothing is in localStorage
        setFileTree(defaultFileTree);
      }

      // Load selectedFile
      const storedSelectedFile = localStorage.getItem("selectedFile");
      if (storedSelectedFile) {
        setSelectedFile(JSON.parse(storedSelectedFile));
      }
    } catch (error) {
      console.warn("Could not parse data from localStorage:", error);
      // Set default file tree if there was an error
      setFileTree(defaultFileTree);
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

  // Listen for file-written events from SSE
  useEffect(() => {
    const handleFileWritten = (payload: any) => {
      if (payload.stage === 'file-written' && payload.item) {
        console.log('[FileContext] Received file-written event:', payload.path);
        setFileTree((prevTree) => mergeIntoTree(prevTree, payload.item));
      }
    };

    eventBus.on('progress', handleFileWritten);
    return () => {
      eventBus.off('progress', handleFileWritten);
    };
  }, []);

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
