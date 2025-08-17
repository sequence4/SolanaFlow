"use client";

import React, { useContext, useState, useRef, useEffect, useCallback } from 'react';
import '@/styles/toolbox/toolboxStyle.css';
import { NodeItems } from '@/components/main/toolbox/workflowToolbox/NodeItems';
import FileExplorer from '@/components/code/FileExplorer';
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import UxContext from '@/context/ux/UxContext';
import eventBus from '@/lib/eventBus';
import 'simplebar-react/dist/simplebar.min.css';
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { NewProjectModal } from '@/components/ui/new-project-modal';
import { Badge } from "@/components/ui/badge";
import ProjectListPopover from '../workflow/ProjectListPopover';
import { toast } from "sonner";
import PulseLoader from "react-spinners/PulseLoader";
import { handleConfirmNewProject, handleOpenProject, handleSaveClick, handleNewProjectClick } from '@/utils/project/projectUtils';
import {
  Search,
  X,
  ArrowRight,
  FolderOpen,
  Save,
  Plus,
  Rocket,
  Hammer,
  Edit2,
} from "lucide-react";
import { deployPipeline } from '@/api/deployPipeline';
import { useWalletSigner } from '@/utils/wallet';
import { ensureId } from '@/utils/project/ensureId';
import { ProgramDeployer } from '@/components/ProgramDeployer';
import { projectApi } from '@/api/projectApi';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import { theme, darkTheme } from '@/styles/theme';

// Add this constant after the imports section
// Prevent duplicate "wallet not connected" toasts
const WALLET_TOAST_ID = 'wallet-not-connected';

/** Memo-friendly helpers */
const NEED_BUILD_TOAST_ID = 'need-build';   // prevents duplicates

// Flag indicating development server mode (only true in SF_DEV_SERVER=1)
const IS_DEV_SERVER = process.env.NEXT_PUBLIC_SF_DEV_SERVER === '1';



export const Toolbox = () => {
    const [isExpanded] = useState(true);
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { fileTree, setFileTree, setSelectedFile } = useContext(FileContext);
    const { activeTab, setUxOpenPanel, setActiveTab } = useContext(UxContext);
    const [activeChainTab] = useState<"off-chain">("off-chain");
    const [projectName, setProjectName] = useState(projectContext.name || "My Token Project");
    const [isEditing, setIsEditing] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const nodeItemsRef = useRef<any>(null);
    const esRef = useRef<ReturnType<typeof deployPipeline> | null>(null);
    const containerURLRef = useRef<string | null>(null);
    const pollingCancelledRef = useRef<boolean>(false);
    const taskLogs = useTaskLogs();
    
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isProjectListModalOpen, setIsProjectListModalOpen] = useState(false);
    const [projectsRefreshCounter, setProjectsRefreshCounter] = useState(0);
    
    const [isDeploying] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    
    const walletSigner = useWalletSigner();

    useEffect(() => {
        setProjectName(projectContext.name || "My Token Project");
        console.log('[Toolbox useEffect] projectContext programId', projectContext.details?.projectState?.programId);
    }, [projectContext.name, projectContext.details?.projectState?.programId, projectContext.details?.projectState?.deployed]);
    
    // Debug: track programId changes to help diagnose context updates
    useEffect(() => {
        console.log('[Toolbox useEffect] context programId changed to', projectContext.details?.projectState?.programId);
    }, [projectContext.details?.projectState?.programId]);


    const handleNewProject = () => {
        handleNewProjectClick(
            setProjectContext,
            projectContext,
            setFileTree,
            setSelectedFile
        );
        setIsNewProjectModalOpen(true);
    };

    const handleCreateProject = (data: { name: string; description: string; repoUrl?: string }) => {
        handleConfirmNewProject(
            projectContext,
            setProjectContext,
            data.name,
            data.description,
            projectsRefreshCounter,
            setProjectsRefreshCounter,
            setUxOpenPanel as (p: string) => void,
            setFileTree,
            setSelectedFile,
            taskLogs
        );
        setIsNewProjectModalOpen(false);
    };

    const handleOpenProjectClick = () => {
        setIsProjectListModalOpen(true);
    };
    
    const handleSaveProject = () => {
        handleSaveClick(
            projectContext, 
            setProjectContext, 
            projectsRefreshCounter, 
            setProjectsRefreshCounter
        );
    };
    
    const handleConfirmBuild = useCallback(async () => {
      if (isBuilding) return;                     // guard re-entry

      /* ------------------------------------------- *
       * 1️⃣  Ensure we have a projectId BEFORE opening SSE
       * ------------------------------------------- */
      const projectId = projectContext.id
        ? projectContext.id
        : await ensureId(projectContext, setProjectContext);

      if (!projectId) {                           // extra safety net
        toast.error("Build error", { description: "Unable to determine project id" });
        return;
      }

      /* ------------------------------------------- *
       * 2️⃣  Mark UI state (no modal / no toast)
       * ------------------------------------------- */
      setIsBuilding(true);
      taskLogs.setSuppressToast(true);            // hide TaskLogs toast

      /* ------------------------------------------- *
       * 3️⃣  Open the SSE stream
       * ------------------------------------------- */
      const graph = {
        nodes: projectContext.details?.projectState?.nodes || [],
        edges: projectContext.details?.projectState?.edges || [],
        config: projectContext.details?.projectState?.config || {},
      };

      try {
        esRef.current = deployPipeline(
          projectId,                              // ✅  ALWAYS defined now
          graph,
          (msg: any) => {
            // ───────────────────────────────────
            //  DEBUG  –  log every raw message
            // ───────────────────────────────────
            console.log('[BUILD DEBUG] raw SSE message', msg);

            // … existing progress / fileTree logic unchanged …
            if (msg.fileTree) {
              console.log(`[BUILD] Received fileTree update`);
              setFileTree(structuredClone(msg.fileTree));
              setActiveTab('code');
            }
            
            if (msg.containerUrl) {
              console.log(`[BUILD] Received container URL: ${msg.containerUrl}`);
              const fullUrl = msg.containerUrl.includes("/dapp/")
                ? msg.containerUrl
                : msg.containerUrl.replace(/\/$/, "") + `/dapp/${projectId}`;
              containerURLRef.current = fullUrl;
              setProjectContext(prev => ({ ...prev, containerUrl: fullUrl }));
            }
            
            if (IS_DEV_SERVER && (msg.stage === "ui-complete" || msg.event === "ui-complete")) {
              // Only auto-open Interface tab in dev mode when UI build is complete
              pollingCancelledRef.current = false;
              const containerUrl = containerURLRef.current;
              if (containerUrl) {
                const checkReady = (attempt: number = 1) => {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 2000);
                  fetch(containerUrl, { method: 'GET', mode: 'no-cors', signal: controller.signal }).then(() => {
                    clearTimeout(timeoutId);
                    console.log('[BUILD] dApp interface is now reachable (HTTP 200)');
                    setActiveTab('interface');
                  }).catch(() => {
                    clearTimeout(timeoutId);
                    if (attempt < 60 && !pollingCancelledRef.current) {
                      setTimeout(() => checkReady(attempt + 1), 1000);
                    } else {
                      console.warn('[BUILD] Interface not reachable after 60 attempts');
                    }
                  });
                };
                checkReady();
              } else {
                console.warn('[BUILD] No container URL available to poll interface readiness');
              }
            }
            
            /* ──────────────────────────────────────────────────
             * Program ID extraction from code‑gen completion
             * Backend emits: "Code generation complete — Program ID: <ID>"
             * ────────────────────────────────────────────────── */
            if (
              msg.stage === 'code-gen' &&
              typeof msg.message === 'string' &&
              msg.message.includes('Program ID')
            ) {
              const m = msg.message.match(/Program ID[: ]+([0-9A-Za-z]+)/);
              if (m) {
                const programId = m[1];
                console.log('[Toolbox code-gen stage] extracted programId', programId);
                setProjectContext(prev => ({
                  ...prev,
                  // ⚠️  shallow‑spread is enough; we only need fresh refs
                  details: {
                    ...prev.details,
                    projectState: {
                      ...(prev.details?.projectState ?? {}),
                      programId,
                    },
                  },
                }));
              }
            }

            if (msg.stage === "done" || msg.stage === "build-done") {
              pollingCancelledRef.current = true;
              setIsBuilding(false);
              esRef.current?.close();
              eventBus.emit("build-complete");
            }
          },
          true                                    // walletSigned
        );

        /* Persist built flag */
        setProjectContext(prev => ({
          ...prev,
          details: {
            ...prev.details!,
            projectState: { ...prev.details!.projectState, built: true, deployed: false }
          }
        }));
        if (projectId) {
          projectApi.updateProject(projectId, { details: { projectState: { built: true } } })
            .catch(err => console.error("[persist build]", err));
        }
      } catch (err) {
        console.error("[build] SSE error:", err);
        toast.error("Build error", { description: String(err) });
        setIsBuilding(false);
      }
    }, [isBuilding, projectContext, setProjectContext, setFileTree, setActiveTab]);
    
    const handleBuildClick = async () => {
      if (isBuilding) return;        // already running
      await handleConfirmBuild();    // ✨ one-liner
    };
    
    const projectDeployed = !!projectContext?.details?.projectState?.deployed;
    const built = !!projectContext.details?.projectState?.built;

    const handleDeployClick = useCallback(() => {
        /* Wallet gate */
        if (!walletSigner.isConnected) {
            toast.error('Please connect your wallet first', {
                id: WALLET_TOAST_ID,
                duration: 4000,
            });
            return;
        }

        /* Build gate */
        if (!built) {
            toast.error('Please build first', {
                id: NEED_BUILD_TOAST_ID,
                duration: 4000,
            });
            return;
        }

        /* ----- Open modal ----------------------------------------------------- */
        setIsDeployModalOpen(true);
    }, [
        walletSigner.isConnected,
        built,
        setIsDeployModalOpen,
    ]);
    
    const handleDeploySuccess = useCallback((programId: string) => {
        if (projectContext.details?.projectState) {
            // Update local project context with new deployed program ID
            const updatedContext = {
                ...projectContext,
                details: {
                    ...projectContext.details,
                    projectState: {
                        ...projectContext.details.projectState,
                        deployed: true,
                        built: false,    // reset built flag so next deploy requires a rebuild
                        programId: programId
                    }
                }
            };
            // Append programId query param to container URL for dApp iframe
            if (projectContext.containerUrl) {
                const sep = projectContext.containerUrl.includes('?') ? '&' : '?';
                updatedContext.containerUrl = `${projectContext.containerUrl}${sep}programId=${programId}`;
            }
            setProjectContext(updatedContext);
            
            // Persist the updated state to the server
            if (projectContext.id) {
                projectApi.updateProject(projectContext.id, {
                    details: {
                        projectState: { 
                            deployed: true,
                            built: false,
                            programId: programId
                        }
                    }
                }).catch(err => {
                    console.error("Failed to persist deployment state:", err);
                });
            }
        }
        
        // Close the deploy modal
        setIsDeployModalOpen(false);
    }, [projectContext, setProjectContext]);

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

    useEffect(() => {
        return () => esRef.current?.close();
    }, []);
    
    // Listen for build commands from the chat
    useEffect(() => {
        const run = () => {
            if (isBuilding) return;              // guard re-entry
            taskLogs.setSuppressToast(true);     // still hidden
            
            /* call the *real* build routine directly – bypasses modal */
            handleConfirmBuild();                // same fn you already wrote
        };
        eventBus.on('chat-build-command', run);
        return () => eventBus.off('chat-build-command', run);
    }, [handleConfirmBuild, isBuilding, taskLogs]);

    return (
        <div
            className="app-sidebar w-[20%] flex flex-col h-full backdrop-blur-xl border-r overflow-hidden shadow-sm bg-sidebar text-foreground"
            style={{
                borderColor: 'var(--sidebar-border)',
            }}
        >
            {/* Compact Project Controls Section */}
            <div 
                className="border-b backdrop-blur-sm bg-sidebar-accent/10"
                style={{
                    borderColor: 'var(--sidebar-border)',
                }}
            >
                <div className="space-y-2 px-3 py-2">
                    {/* Project Name with inline edit */}
                    <div className="flex items-center gap-2 h-8">
                        <div 
                            className="flex-1 px-2 py-1 rounded-md border"
                            style={{
                                backgroundColor: theme.colors.bg.hover,
                                borderColor: theme.colors.border.primary,
                            }}
                        >
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="bg-transparent text-sm font-medium w-full focus:outline-none"
                                    style={{ color: theme.colors.text.primary }}
                                    autoFocus
                                    onBlur={() => {
                                        setIsEditing(false);
                                        setProjectContext((prev) => ({
                                            ...prev,
                                            name: projectName
                                        }));
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            setIsEditing(false);
                                            setProjectContext((prev) => ({
                                                ...prev,
                                                name: projectName
                                            }));
                                        }
                                    }}
                                />
                            ) : (
                                <div 
                                    className="text-sm font-medium truncate cursor-pointer"
                                    style={{ color: theme.colors.text.primary }}
                                    onClick={() => setIsEditing(true)}
                                >
                                    {projectName}
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                        >
                            <Edit2 size={14} style={{ color: theme.colors.text.secondary }} />
                        </button>
                    </div>
                    
                    {/* Compact 2x3 Button Grid */}
                    <div className="grid grid-cols-3 gap-1">
                        <button 
                            onClick={handleOpenProjectClick}
                            className="h-7 px-2 rounded-md flex items-center justify-center gap-1 text-xs font-medium border transition-all hover:scale-105 text-white border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80"
                        >
                            <FolderOpen size={12} />
                            <span>Open</span>
                        </button>
                        <button 
                            onClick={handleSaveProject}
                            disabled={!projectContext.id}
                            className="h-7 px-2 rounded-md flex items-center justify-center gap-1 text-xs font-medium border transition-all hover:scale-105 disabled:opacity-50 text-white border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80"
                        >
                            <Save size={12} />
                            <span>Save</span>
                        </button>
                        <button 
                            onClick={handleNewProject}
                            className="h-7 px-2 rounded-md flex items-center justify-center gap-1 text-xs font-medium border transition-all hover:scale-105 text-white border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80"
                        >
                            <Plus size={12} />
                            <span>New</span>
                        </button>
                        
                        {/* Second row - Build/Deploy */}
                        <button
                            onClick={handleBuildClick}
                            className="h-7 col-span-2 rounded-md flex items-center justify-center gap-1 text-xs font-medium border transition-all hover:scale-105 text-white border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80"
                        >
                            {isBuilding ? (
                                <PulseLoader color="white" size={3} cssOverride={{ display: 'inline-block', margin: 0 }} />
                            ) : (
                                <Hammer size={12} />
                            )}
                            <span>Build</span>
                        </button>
                        <button
                            onClick={handleDeployClick}
                            disabled={isDeploying || !walletSigner.isConnected || !built}
                            className="h-7 rounded-md flex items-center justify-center gap-1 text-xs font-medium border transition-all hover:scale-105 disabled:opacity-50 text-white border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80"
                        >
                            {isDeploying ? (
                                <PulseLoader color="white" size={3} cssOverride={{ display: 'inline-block', margin: 0 }} />
                            ) : (
                                <Rocket size={12} />
                            )}
                            <span>
                                {projectDeployed ? "Deployed" : "Deploy"}
                            </span>
                        </button>
                    </div>
                    
                    
                </div>
                
                {/* Program ID Display */}
                {projectDeployed && projectContext.details?.projectState?.programId && (
                    <div 
                        className="mx-3 mb-2 rounded-lg p-2 border backdrop-blur-sm"
                        style={{
                            backgroundColor: theme.colors.bg.hover,
                            borderColor: theme.colors.border.primary,
                        }}
                    >
                        <div className="flex items-center text-xs">
                            <span style={{ color: theme.colors.text.secondary }}>Program ID:</span>
                            <a 
                                href={`https://explorer.solana.com/address/${projectContext.details?.projectState?.programId}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 truncate hover:underline"
                                style={{ color: theme.colors.accent.primary }}
                                title={projectContext.details?.projectState?.programId}
                            >
                                {projectContext.details?.projectState?.programId?.substring(0, 20)}...
                            </a>
                            <button 
                                onClick={() => window.open(`https://explorer.solana.com/address/${projectContext.details?.projectState?.programId}?cluster=devnet`, '_blank')}
                                className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <ArrowRight className="h-3 w-3" style={{ color: theme.colors.text.secondary }} />
                            </button>
                        </div>
                    </div>
                )}
                
            </div>

            {/* Enhanced Search Bar */}
            <div 
                className="border-t border-b backdrop-blur-sm bg-sidebar-accent/10"
                style={{
                    borderColor: 'var(--sidebar-border)',
                }}
            >
                <div className="px-3 py-2">
                    <div className="relative group">
                        <div 
                            className="absolute inset-0 rounded-lg blur-xl opacity-0 group-focus-within:opacity-50 transition-opacity"
                            style={{
                                background: `linear-gradient(to right, ${theme.colors.accent.primary}20, ${theme.colors.accent.purple}20)`,
                            }}
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search nodes..."
                            className="relative w-full h-8 rounded-lg pl-8 pr-8 text-xs transition-all focus:outline-none bg-sidebar-accent border border-sidebar-border text-foreground focus:ring-1 focus:ring-primary"
                            onFocus={() => {
                                setIsFocused(true);
                            }}
                            onBlur={() => {
                                setIsFocused(false);
                            }}
                        />
                        <Search 
                            className="absolute left-2.5 top-2.5 h-3 w-3" 
                            style={{ color: theme.colors.text.tertiary }}
                        />
                        {searchValue && (
                            <button
                                className="absolute right-2 top-2 p-0.5 hover:bg-white/10 rounded transition-colors"
                                onClick={() => setSearchValue("")}
                            >
                                <X className="h-3 w-3" style={{ color: theme.colors.text.secondary }} />
                            </button>
                        )}
                        {!searchValue && !isFocused && (
                            <div 
                                className="absolute right-3 top-2.5 text-[10px] font-mono"
                                style={{ color: theme.colors.text.tertiary }}
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
                                className="px-2 py-0.5 text-[10px] border rounded-full transition-all hover:scale-105"
                                style={{
                                    backgroundColor: theme.colors.bg.hover,
                                    borderColor: theme.colors.border.primary,
                                    color: theme.colors.text.secondary,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.bg.tertiary;
                                    e.currentTarget.style.color = theme.colors.text.primary;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.bg.hover;
                                    e.currentTarget.style.color = theme.colors.text.secondary;
                                }}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {/* WORKFLOW node library */}
                {isExpanded && activeTab === 'workflow' && (
                    <NodeItems
                        ref={nodeItemsRef}
                        activeChainTab="offChain"
                    />
                )}

                {/* CODE tab — file explorer lives here */}
                {activeTab === 'code' && (
                    <FileExplorer />
                )}

                {/* INTERFACE placeholder (unchanged) */}
                {activeTab === 'interface' && (
                    <div className="p-4 text-slate-400">
                        <p>Interface Tab Toolbox Placeholder</p>
                    </div>
                )}
            </div>

            <NewProjectModal
                open={isNewProjectModalOpen}
                onOpenChange={setIsNewProjectModalOpen}
                onSubmit={handleCreateProject}
            />

            {/* Program deployer modal */}
            {isDeployModalOpen && projectContext.id && (
                <ProgramDeployer
                    projectId={projectContext.id}
                    isOpen={isDeployModalOpen}
                    onClose={() => setIsDeployModalOpen(false)}
                    onSuccess={handleDeploySuccess}
                />
            )}



            <Dialog open={isProjectListModalOpen} onOpenChange={(open) => setIsProjectListModalOpen(open)}>
                <DialogContent 
                    aria-describedby="project-list-desc"
                    className="bg-[#111827] text-slate-100" 
                    style={{width: "fit-content", border: "1px solid rgb(36, 45, 68)"}}>
                    <DialogDescription id="project-list-desc" className="sr-only">
                        Select a project from your list of SolanaFlow projects.
                    </DialogDescription>
                    <ProjectListPopover
                        modalIsOpen={isProjectListModalOpen}
                        refreshTrigger={projectsRefreshCounter}
                        onProjectClick={(projectId) => {
                            handleOpenProject(projectId, projectContext, setProjectContext, setSelectedFile);
                            setIsProjectListModalOpen(false);
                        }}
                        closePopover={() => setIsProjectListModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};