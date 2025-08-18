import React, { useState, useContext, useEffect } from 'react';
import '@xyflow/react/dist/style.css';
import { useColorModeValue } from '@/components/ui/color-mode';
import { FileTreeItemType } from '@/interfaces/FileTreeItemType';
import { FiTerminal } from "react-icons/fi";
import { Button } from '@/components/ui/button';

import CodeEditor from './CodeEditor';
import SolanaTerminal from './SolanaTerminal';

import '../../../styles/code/codeTabStyle';
    
import UxContext from '../../../context/ux/UxContext';
import FileContext from '../../../context/file/FileContext';

const Code = () => {
    const { setUxOpenPanel, activeTab } = useContext(UxContext);
    const { selectedFile, setSelectedFile, fileTree } = useContext(FileContext);

    const borderColor = useColorModeValue('var(--border-2-light)', 'var(--border-2-dark)');
    const codeBg = useColorModeValue('var(--code-bg-light)', 'var(--code-bg-dark)');  

    // Find the first file in the tree that matches the given name
    const findFileByName = (tree: FileTreeItemType, name: string): FileTreeItemType | null => {
        if (tree.type === 'file' && tree.name === name) return tree;
        
        if (tree.children) {
            for (const child of tree.children) {
                const found = findFileByName(child, name);
                if (found) return found;
            }
        }
        return null;
    };

    // Find the first file in the tree
    const findFirstFile = (tree: FileTreeItemType): FileTreeItemType | null => {
        if (tree.type === 'file') return tree;
        
        if (tree.children) {
            for (const child of tree.children) {
                const found = findFirstFile(child);
                if (found) return found;
            }
        }
        return null;
    };

    // Effect to set default file when code tab is active and no file is selected
    useEffect(() => {
        if (activeTab === 'code' && !selectedFile && fileTree) {
            // First try to find Anchor.toml
            let defaultFile = findFileByName(fileTree as FileTreeItemType, 'Anchor.toml');
            
            // If not found, just pick the first file in the tree
            if (!defaultFile) {
                defaultFile = findFirstFile(fileTree as FileTreeItemType);
            }
            
            // Set the selected file if we found one
            if (defaultFile) {
                setSelectedFile(defaultFile);
                console.log('Auto-selected file:', defaultFile.name);
            }
        }
    }, [activeTab, selectedFile, setSelectedFile, fileTree]);

    const getLanguage = (ext?: string) => {
        if (ext === "rs") return "rust";
        if (ext === "ts") return "typescript";
        if (ext === "toml") return "toml";
        return "typescript";
    };

    const terminalBg = useColorModeValue('var(--terminal-bg-light)', 'var(--terminal-bg-dark)');
    const terminalBorder = useColorModeValue('var(--border-2-light)', 'var(--border-2-dark)');
    
    return (
      <div className="flex flex-col w-full h-full bg-card">
        <div className="flex-1 min-h-0">
          <CodeEditor language={getLanguage(selectedFile?.ext)} />
        </div>
        <div style={{ height: "32%" }} className="border-t border-border">
          <SolanaTerminal />
        </div>
      </div>
    );
}

export default Code;