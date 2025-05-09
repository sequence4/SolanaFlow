"use client";

import React, { useContext, useState, useRef, useEffect } from 'react';
import '@/styles/toolbox/toolboxStyle.css';
import { NodeItems } from '@/components/main/toolbox/workflowToolbox/NodeItems';
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import UxContext from '@/context/ux/UxContext';
import 'simplebar-react/dist/simplebar.min.css';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NewProjectModal } from '@/components/ui/new-project-modal';
import ProjectListPopover from '../workflow/ProjectListPopover';
import { toast } from "sonner";
import PulseLoader from "react-spinners/PulseLoader";
import { handleConfirmNewProject, handleOpenProject, handleSaveClick } from '@/utils/project/projectUtils';
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
  ChevronRight,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label";
import { runDeployPipelineWithLogs } from '@/utils/deploy/deployPipeline';
import { useEnsureProjectId } from '@/hooks/useEnsureProjectId';

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
    
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isProjectListModalOpen, setIsProjectListModalOpen] = useState(false);
    const [projectsRefreshCounter, setProjectsRefreshCounter] = useState(0);
    
    const [isDeploying, setIsDeploying] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [selectedOption, setSelectedOption] = useState('user-wallet');
    
    const taskLogs = useTaskLogs();
    const { ensureId, modalOpen, setModalOpen, handleModalSubmit } = useEnsureProjectId(projectContext, setProjectContext);

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
            setUxOpenPanel,
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
    
    const handleOpenDeployModal = () => {
        setShowDeployModal(true);
    };

    const handleDeployCancel = () => {
        setShowDeployModal(false);
    };
    
    const handleDeployClick = async () => {
        if (isDeploying) return;
        setIsDeploying(true);
        
        setShowDeployModal(false);
        console.log('[deploy] Starting deploy process...');
        
        try {
            console.log('[deploy] Calling ensureId()');
            const id = await ensureId();
            console.log(`[deploy] Project ID ensured: ${id}`);
            
            const graph = projectContext.details?.projectState ?? {};
            console.log('[deploy] Graph data:', graph);

            console.log('[deploy] Calling runDeployPipelineWithLogs');
            await runDeployPipelineWithLogs(
              { ...projectContext, id },
              graph,
              taskLogs
            );
        } catch (err) {
            console.error('[deploy] Deployment error:', err);
            toast("Deployment error", {
                description: String(err),
                style: { backgroundColor: "#f87171", color: "white" }
            });
        } finally {
            setIsDeploying(false);
        }
    };
    
    const projectDeployed = !!projectContext?.details?.projectState?.deployed;
    const canDeploy = fileTree !== null || projectDeployed;

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
                            className="cursor-pointer bg-[#1e1e20] border border-[#2a2a2d] hover:bg-[#2a2a2d] h-8 rounded-md text-xs font-medium flex items-center justify-center"
                            onClick={projectDeployed ? undefined : handleOpenDeployModal}
                            disabled={!canDeploy}
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

            {/* Project creation modal triggered by ensureId() */}
            <NewProjectModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSubmit={handleModalSubmit}
            />

            <Dialog open={isProjectListModalOpen} onOpenChange={(open) => setIsProjectListModalOpen(open)}>
                <DialogContent className="bg-[#111827] text-slate-100" 
                style={{width: "fit-content", border: "1px solid rgb(36, 45, 68)"}}>
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
            
            {showDeployModal && (
                <Dialog open={showDeployModal} onOpenChange={handleDeployCancel}>
                    <DialogContent className="p-0 sm:max-w-md border border-[#2a2a2a] bg-[#121212] text-gray-200 rounded-md shadow-xl overflow-hidden [&>button]:hidden">
                        <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#151515] px-4 py-2">
                            <div className="text-sm font-medium text-white">Select a deployment option</div>
                            <button 
                                onClick={handleDeployCancel}
                                className="cursor-pointer h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#252525] transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-2">
                                <div
                                    className={`flex items-center space-x-3 rounded-md border ${
                                        selectedOption === "user-wallet" ? "border-[#333333] bg-[#1a1a1a]" : "border-[#222222] bg-[#151515]"
                                    } p-3`}
                                >
                                    <RadioGroupItem value="user-wallet" id="user-wallet" className="border-[#444444]" />
                                    <Label htmlFor="user-wallet" className="flex flex-col cursor-pointer w-full">
                                        <div className="flex justify-between w-full">
                                            <span className="font-medium text-white text-sm">User Wallet Control</span>
                                            {selectedOption === "user-wallet" && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-[#3b82f6] text-white">Selected</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500 mt-1">Deploy with your connected wallet</span>
                                    </Label>
                                </div>

                                <div
                                    className={`flex items-center space-x-3 rounded-md border ${
                                        selectedOption === "delegated" ? "border-[#333333] bg-[#1a1a1a]" : "border-[#222222] bg-[#151515]"
                                    } p-3`}
                                >
                                    <RadioGroupItem value="delegated" id="delegated" className="border-[#444444]" />
                                    <Label htmlFor="delegated" className="flex flex-col cursor-pointer w-full">
                                        <div className="flex justify-between w-full">
                                            <span className="font-medium text-white text-sm">Delegated Control</span>
                                            {selectedOption === "delegated" && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-[#3b82f6] text-white">Selected</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500 mt-1">Deploy with delegated permissions</span>
                                    </Label>
                                </div>
                            </RadioGroup>

                            <div className="text-xs text-[#6b7280] mt-2 border-t border-[#2a2a2a] pt-3">
                                <div className="flex items-center">
                                    <span className="inline-block w-2 h-2 rounded-full bg-[#10b981] mr-2"></span>
                                    System ready for deployment
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between border-t border-[#2a2a2a] bg-[#151515] px-4 py-2">
                            <Button
                                variant="outline"
                                onClick={handleDeployCancel}
                                className="h-8 text-xs border-[#333333] bg-transparent text-gray-300 hover:bg-[#252525] hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeployClick}
                                className="h-8 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center cursor-pointer"
                            >
                                {isDeploying ? (
                                    <PulseLoader
                                        color="#fff"
                                        size={6}
                                        cssOverride={{ display: 'inline-block', margin: '0' }}
                                    />
                                ) : (
                                    <div className="flex items-center">
                                        Deploy <ChevronRight className="ml-1 h-3 w-3" />
                                    </div>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};