"use client";

import React, { useContext, useState, useRef, useEffect, useCallback } from 'react';
import '@/styles/toolbox/toolboxStyle.css';
import { NodeItems } from '@/components/main/toolbox/workflowToolbox/NodeItems';
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import UxContext from '@/context/ux/UxContext';
import 'simplebar-react/dist/simplebar.min.css';
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NewProjectModal } from '@/components/ui/new-project-modal';
import ProjectListPopover from '../workflow/ProjectListPopover';
import { toast } from "sonner";
import clsx from "clsx";
import PulseLoader from "react-spinners/PulseLoader";
import { handleConfirmNewProject, handleOpenProject, handleSaveClick, handleNewProjectClick } from '@/utils/project/projectUtils';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import {
  Search,
  X,
  Filter,
  Settings,
  Clock,
  Edit3,
  ArrowRight,
  Info,
  FolderOpen,
  Save,
  Plus,
  Rocket,
  Hammer,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { runDeployPipelineWithLogs } from '@/utils/deploy/deployPipeline';
import { useWalletSigner } from '@/utils/wallet';
import { ensureId } from '@/utils/project/ensureId';
import { ProgramDeployer } from '@/components/ProgramDeployer';
import { projectApi } from '@/api/projectApi';

// Add this constant after the imports section
// Prevent duplicate "wallet not connected" toasts
const WALLET_TOAST_ID = 'wallet-not-connected';

/** Memo-friendly helpers */
const NEED_BUILD_TOAST_ID = 'need-build';   // prevents duplicates

export const Toolbox = () => {
    const [isExpanded] = useState(true);
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { fileTree, setFileTree, setSelectedFile } = useContext(FileContext);
    const { activeTab, setUxOpenPanel } = useContext(UxContext);
    const [activeChainTab, setActiveChainTab] = useState<"on-chain" | "off-chain">("on-chain");
    const [projectName, setProjectName] = useState(projectContext.name || "My Token Project");
    const [isEditing, setIsEditing] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const nodeItemsRef = useRef<any>(null);
    const esRef = useRef<ReturnType<typeof runDeployPipelineWithLogs> | null>(null);
    const [artifactUrl, setArtifactUrl] = useState<string | null>(null);
    
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isProjectListModalOpen, setIsProjectListModalOpen] = useState(false);
    const [projectsRefreshCounter, setProjectsRefreshCounter] = useState(0);
    
    const [isDeploying, setIsDeploying] = useState(false);
    const [isBuilding, setIsBuilding] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    
    const taskLogs = useTaskLogs();
    const [modalOpen, setModalOpen] = useState(false);
    const walletSigner = useWalletSigner();

    useEffect(() => {
        setProjectName(projectContext.name || "My Token Project");
        console.log('projectContext programId', projectContext.details?.projectState?.programId);
    }, [projectContext.name, projectContext.details?.projectState?.programId, projectContext.details?.projectState?.deployed]);

    const handleTabChange = (tab: "on-chain" | "off-chain") => {
        setActiveChainTab(tab);
        if (nodeItemsRef.current) {
            nodeItemsRef.current.setActiveChainTab(tab === "on-chain" ? "onChain" : "offChain");
        }
    };

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
        taskLogs.resetLogs();
        
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
    
    const handleBuildClick = useCallback(async () => {
        if (isBuilding) return;
        
        try {
            const id = await ensureId(projectContext, setProjectContext);
            
            setIsBuilding(true);
            
            // -----------------------------------------------------------------
            //  Run the heavy build pipeline *after* the fast metadata insert
            // -----------------------------------------------------------------
            taskLogs.resetLogs();
            taskLogs.setIsVisible(true);
            taskLogs.addSystemLog("🔨 Building program...");
            
            const graph = {
                ...(projectContext.details?.projectState ?? {}),
                nodes: projectContext.details?.projectState?.nodes ?? [],
            };
            
            try {
                // Run the build pipeline
                await new Promise<void>((resolve, reject) => {
                    try {
                        esRef.current = runDeployPipelineWithLogs(
                            { ...projectContext, id },
                            graph,
                            taskLogs,
                            setProjectContext,
                            setArtifactUrl,
                            (status?: 'error') => status === 'error' ? reject(new Error('Build failed')) : resolve()
                        );
                    } catch (error) {
                        reject(error);
                    }
                });
                
                taskLogs.addSystemLog("✅ Build completed successfully!");
                
                // 1.  **Always** update the local context immediately so the UI reacts
                setProjectContext(prev => ({
                  ...prev,
                  details: {
                    ...prev.details!,
                    projectState: {
                      ...prev.details!.projectState,
                      built: true,          // ➜ enables Deploy button
                      deployed: false
                    }
                  }
                }));
                
                // 2.  Fire-and-forget persistence (best effort)
                if (projectContext.id) {
                  projectApi.updateProject(projectContext.id, {
                    details: { projectState: { built: true } }
                  }).catch(err => {
                    console.error("Failed to persist build state:", err);
                    // UI is already updated, so just log
                  });
                }
                
                toast.success("Build completed");
                
            } catch (error) {
                console.error('[build] Build error:', error);
                taskLogs.addSystemLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
                toast.error("Build failed", {
                    description: String(error)
                });
            } finally {
                setIsBuilding(false);
            }
        } catch (err) {
            console.error('[build] Error:', err);
            toast.error("Build error", {
                description: String(err)
            });
            setIsBuilding(false);
        }
    }, [isBuilding, setIsBuilding, taskLogs, projectContext, setProjectContext, setArtifactUrl]);
    
    const projectDeployed = !!projectContext?.details?.projectState?.deployed;
    const built = !!projectContext.details?.projectState?.built;
    const canDeploy = fileTree !== null || projectDeployed;

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
        // Update project context with deployed status and program ID
        if (projectContext.details?.projectState) {
            const updatedContext = {
                ...projectContext,
                details: {
                    ...projectContext.details,
                    projectState: {
                        ...projectContext.details.projectState,
                        deployed: true,
                        built: false,    // reset built flag so next deploy requires a rebuild
                        programId
                    }
                }
            };
            setProjectContext(updatedContext);
            
            // Persist the updated state to the server
            if (projectContext.id) {
                projectApi.updateProject(projectContext.id, {
                    details: {
                        projectState: { 
                            deployed: true,
                            built: false,
                            programId
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
        return () => {
            if (esRef.current) {
                console.log('[deploy] Closing EventSource on unmount');
                esRef.current.close();
            }
        };
    }, []);

    return (
        <div
            className="app-sidebar w-[20%] flex flex-col h-full bg-[#121214] text-white border-r border-[#2a2a2d] overflow-hidden"
        >
            <div className="p-4 border-b border-[#2a2a2d]">
                <div className="flex justify-between items-center">
                    <div className="text-xs font-medium text-[#6e6e76] uppercase tracking-wider">PROJECT</div>
                    <div className="flex items-center space-x-2">
                        <button className="p-1 h-7 w-7 rounded-full hover:bg-[#2a2a2d] text-[#6e6e76] hover:text-white transition-colors">
                            <Info className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 h-7 w-7 rounded-full hover:bg-[#2a2a2d] text-[#6e6e76] hover:text-white transition-colors">
                            <Settings className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                <div className="mt-3">
                    <div className="flex items-center">
                        {isEditing ? (
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="bg-[#1e1e20] border border-[#2a2a2d] rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4d7cfe] w-full"
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
                            <div className="flex items-center justify-between w-full">
                                <h3 className="text-lg font-semibold text-white">{projectName}</h3>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-1 rounded-full hover:bg-[#2a2a2d] text-[#6e6e76] hover:text-white transition-colors"
                                >
                                    <Edit3 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center mt-2 space-x-2 text-[#6e6e76] mb-4">
                        <span className="w-2 h-2 rounded-full bg-[#4d7cfe]"></span>
                        <span className="text-xs">Token • Mint • Transfer</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <button 
                            className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-9 rounded-md text-xs font-medium flex items-center justify-center"
                            onClick={handleOpenProjectClick}
                        >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            <span className="flex items-center">Open</span>
                        </button>
                        <button 
                            className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-9 rounded-md text-xs font-medium flex items-center justify-center"
                            onClick={handleSaveProject}
                            disabled={!projectContext.id}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            <span className="flex items-center">Save</span>
                        </button>
                        <button 
                            className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-9 rounded-md text-xs font-medium flex items-center justify-center"
                            onClick={handleNewProject}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            <span className="flex items-center">New</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mb-4">
                        <button
                            onClick={handleBuildClick}
                            disabled={!fileTree || isBuilding}
                            className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-8 rounded-md text-xs font-medium flex items-center justify-center"
                        >
                            {isBuilding ? (
                                <PulseLoader color="#9de19f" size={3} cssOverride={{ display: 'inline-block', margin: 0 }} />
                            ) : (
                                <>
                                    <Hammer className="h-4 w-4 mr-2 text-[#22c55e]" />
                                    <span>Build</span>
                                </>
                            )}
                        </button>
                        <div className="relative">
                            <button
                                onClick={handleDeployClick}
                                disabled={isDeploying}
                                className={clsx(
                                    'w-full cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-8 rounded-md text-xs font-medium flex items-center justify-center',
                                    (!walletSigner.isConnected || !built) && 'opacity-70 cursor-not-allowed'
                                )}
                            >
                                {isDeploying ? (
                                    <PulseLoader
                                        color="#80a3ff"
                                        size={3}
                                        cssOverride={{ display: 'inline-block', margin: '0' }}
                                    />
                                ) : (
                                    <>
                                        <Rocket className={`h-4 w-4 mr-2 ${projectDeployed ? "text-[#9de19f]" : ""}`} />
                                        <span>{projectDeployed ? "Program Deployed" : "Deploy Program"}</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {artifactUrl && (
                            <a 
                                href={artifactUrl} 
                                download="program.so" 
                                className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-8 rounded-md text-xs font-medium flex items-center justify-center text-[#4d7cfe] mt-2"
                            >
                                <span>Download compiled program</span>
                            </a>
                        )}
                    </div>
                    
                    {projectDeployed && projectContext.details?.projectState?.programId && (
                        <div className="bg-[#1e1e20] border border-[#2a2a2d] rounded-md p-2 mb-4">
                            <div className="flex items-center text-xs">
                                <span className="text-[#6e6e76] mr-2">Program ID:</span>
                                <a 
                                    href={`https://explorer.solana.com/address/${projectContext.details?.projectState?.programId}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#4d7cfe] hover:text-[#4d7cfe]/90 truncate"
                                    title={projectContext.details?.projectState?.programId}
                                >
                                    {projectContext.details?.projectState?.programId?.substring(0, 20)}...
                                </a>
                                <button 
                                    onClick={() => window.open(`https://explorer.solana.com/address/${projectContext.details?.projectState?.programId}?cluster=devnet`, '_blank')}
                                    className="ml-auto p-1 rounded-full hover:bg-[#2a2a2d] text-[#6e6e76] hover:text-white transition-colors"
                                >
                                    <ArrowRight className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'workflow' && (
                        <>
                            <div className="text-xs font-medium text-[#6e6e76] uppercase tracking-wider pb-2">NODE LIBRARY</div>
                            <Separator />            
                            <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#1e1e20] rounded-md">
                                <button
                                    className={`h-8 rounded-md text-xs font-medium transition-all ${
                                        activeChainTab === "on-chain"
                                            ? "bg-[#4d7cfe] text-white hover:bg-[#4d7cfe]/90"
                                            : "bg-transparent text-[#6e6e76] hover:bg-[#2a2a2d] hover:text-white"
                                    }`}
                                    onClick={() => handleTabChange("on-chain")}
                                >
                                    On-Chain
                                </button>
                                <button
                                    className={`h-8 rounded-md text-xs font-medium transition-all ${
                                        activeChainTab === "off-chain"
                                            ? "bg-[#4d7cfe] text-white hover:bg-[#4d7cfe]/90"
                                            : "bg-transparent text-[#6e6e76] hover:bg-[#2a2a2d] hover:text-white"
                                    }`}
                                    onClick={() => handleTabChange("off-chain")}
                                >
                                    Off-Chain
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="p-4 border-b border-[#2a2a2d]">
                <div className="relative">
                    <Search
                        className="absolute left-4 top-2 mt-[0.4px] h-3 w-3 text-[#6e6e76]"
                    />

                    <input
                        ref={inputRef}
                        type="text"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="Search instructions..."
                        className="w-full h-8 bg-[#1e1e20] border border-[#2a2a2d] rounded-lg pl-10 pr-10 py-2 text-xs text-gray-300 placeholder-[#6e6e76] focus:outline-none focus:ring-[#4d7cfe]"
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />

                    {searchValue && (
                        <button
                            className="text-[#6e6e76] hover:text-white transition-colors cursor-pointer"
                            onClick={() => setSearchValue("")}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}

                    {!searchValue && !isFocused && (
                        <div className="absolute right-3 top-2.5 text-[10px] text-[#6e6e76]">
                            Ctrl+F
                        </div>
                    )}
                </div>

                {isFocused && (
                    <div className="flex items-center justify-between mt-2 px-1 text-xs text-[#6e6e76]">
                        <div className="flex items-center space-x-2">
                            <button className="flex items-center space-x-1 hover:text-white transition-colors">
                                <Filter className="h-3 w-3" />
                                <span>Filters</span>
                            </button>
                            <button className="flex items-center space-x-1 hover:text-white transition-colors">
                                <Clock className="h-3 w-3" />
                                <span>Recent</span>
                            </button>
                        </div>
                        <button className="hover:text-white transition-colors">Advanced</button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                {isExpanded && activeTab === 'workflow' && (
                    <NodeItems 
                        ref={nodeItemsRef}
                        activeChainTab={activeChainTab === "on-chain" ? "onChain" : "offChain"}
                    />
                )}
                {activeTab === 'interface' && (
                    <div className="p-4 text-[#6e6e76]">
                        <p>Interface Tab Toolbox Placeholder</p>
                    </div>
                )}
            </div>

            <NewProjectModal
                open={isNewProjectModalOpen}
                onOpenChange={setIsNewProjectModalOpen}
                onSubmit={handleCreateProject}
            />

            {/* Project creation modal */}
            <NewProjectModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSubmit={async (data) => {
                    const response = await projectApi.createProject({
                        name: data.name,
                        description: data.description,
                    });
                    
                    setProjectContext(prev => ({
                        ...prev,
                        id: response.project.id,
                        name: data.name,
                        description: data.description,
                    }));
                    
                    setModalOpen(false);
                }}
            />
            
            {/* Program deployer modal */}
            {isDeployModalOpen && projectContext.id && (
                <ProgramDeployer
                    projectId={projectContext.id}
                    isOpen={isDeployModalOpen}
                    onClose={() => setIsDeployModalOpen(false)}
                    onSuccess={handleDeploySuccess}
                    taskLogs={taskLogs}
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
                        onProjectClick={(projectId, projectName) => {
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