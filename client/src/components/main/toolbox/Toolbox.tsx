"use client";

import React, { useContext, useState, useRef, useEffect } from 'react';
import '@/styles/toolbox/toolboxStyle.css';
import { NodeItems } from '@/components/main/toolbox/workflowToolbox/NodeItems';
import FileExplorer from '@/components/main/code/FileExplorer';
import UxContext from '@/context/ux/UxContext';
import 'simplebar-react/dist/simplebar.min.css';
import {
  Search,
  X,
} from "lucide-react";

export const Toolbox = () => {
    const [isExpanded] = useState(true);
    const { activeTab } = useContext(UxContext);
    const [searchValue, setSearchValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const nodeItemsRef = useRef<any>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div
            className="app-sidebar w-[300px] flex-shrink-0 flex flex-col h-full backdrop-blur-xl border-r overflow-hidden shadow-sm bg-card text-foreground border-border"
        >
            {/* Enhanced Search Bar */}
            <div 
                className="border-t border-b backdrop-blur-sm bg-card border-border"
            >
                <div className="px-3 py-2">
                    <div className="relative group">
                        <div 
                            className="absolute inset-0 rounded-lg blur-xl opacity-0 group-focus-within:opacity-50 transition-opacity bg-gradient-to-r from-primary/20 to-purple-600/20"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search nodes..."
                            className="relative w-full h-8 rounded-lg pl-8 pr-8 text-xs transition-all focus:outline-none bg-muted border border-border text-foreground focus:ring-1 focus:ring-primary"
                            onFocus={() => {
                                setIsFocused(true);
                            }}
                            onBlur={() => {
                                setIsFocused(false);
                            }}
                        />
                        <Search 
                            className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" 
                        />
                        {searchValue && (
                            <button
                                className="absolute right-2 top-2 p-0.5 hover:bg-white/10 rounded transition-colors"
                                onClick={() => setSearchValue("")}
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                        )}
                        {!searchValue && !isFocused && (
                            <div 
                                className="absolute right-3 top-2.5 text-[10px] font-mono text-muted-foreground"
                            >
                                Ctrl+F
                            </div>
                        )}
                    </div>
                    
                    {/* Quick Filters - Tiny Pills */}
                    <div className="flex gap-1 mt-2">
                        {['Recent', 'Favorites', 'Popular'].map((filter) => (
                            <button
                                key={filter}
                                className="px-2 py-0.5 text-[10px] border rounded-full transition-all hover:scale-105 bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {/* WORKFLOW node library */}
                {isExpanded && activeTab === "workflow" && (
                    <NodeItems 
                        ref={nodeItemsRef}
                    />
                )}

                {activeTab === "code" && (
                    <FileExplorer />
                )}

                {activeTab === "interface" && (
                    <div className="p-4 text-xs text-center text-muted-foreground">
                        Interface View Active
                    </div>
                )}
            </div>
        </div>
    );
};

export default Toolbox;