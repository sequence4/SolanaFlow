"use client";

import React, { useState, useContext, useRef, useCallback, useEffect } from 'react';
import { 
  FolderOpen, 
  Save, 
  Plus, 
  Rocket, 
  Hammer, 
  Edit2,
  Trash2,
  Check,
  Network,
  Copy,
  Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import UxContext from '@/context/ux/UxContext';
import { toast } from 'sonner';
import PulseLoader from 'react-spinners/PulseLoader';
import { handleConfirmNewProject } from '@/utils/project/handleConfirmNewProject';
import { handleOpenProject } from '@/utils/project/handleOpenProject';
import { handleSaveClick } from '@/utils/project/handleSaveClick';
import { handleNewProjectClick } from '@/utils/project/handleNewProjectClick';
import { deployPipeline } from '@/api/deployPipeline';
import { ensureId } from '@/utils/project/ensureId';
import { ProgramDeployer } from '@/components/ProgramDeployer';
import { projectApi } from '@/api/projectApi';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import eventBus from '@/lib/eventBus';
import { NewProjectModal } from '@/components/ui/new-project-modal';
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import ProjectListPopover from '@/components/main/workflow/ProjectListPopover';
import { connectionManager } from '@/utils/blockchain/connectionManager';
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";

const NEED_BUILD_TOAST_ID = 'need-build';
const IS_DEV_SERVER = process.env.NEXT_PUBLIC_SF_DEV_SERVER === '1';

interface ChatHeaderProps {
  onDeleteChat?: () => void;
}

export function ChatHeader({ onDeleteChat }: ChatHeaderProps) {
  const { projectContext, setProjectContext } = useContext(ProjectContext);
  const { setFileTree, setSelectedFile } = useContext(FileContext);
  const { setUxOpenPanel, setActiveTab } = useContext(UxContext);
  const [isEditing, setIsEditing] = useState(false);
  const [projectName, setProjectName] = useState(projectContext.name || "My Token Project");
  const [isBuilding, setIsBuilding] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isProjectListModalOpen, setIsProjectListModalOpen] = useState(false);
  const [projectsRefreshCounter, setProjectsRefreshCounter] = useState(0);
  const [isLocalDeploying, setIsLocalDeploying] = useState(false);
  
  const taskLogs = useTaskLogs();
  const { connected, publicKey, connect, disconnect, select } = useWallet();
  const esRef = useRef<ReturnType<typeof deployPipeline> | null>(null);
  const containerURLRef = useRef<string | null>(null);
  const pollingCancelledRef = useRef<boolean>(false);
  
  const projectDeployed = !!projectContext?.details?.projectState?.deployed;
  const built = !!projectContext.details?.projectState?.built;
  const currentNetwork = projectContext.deployNetwork || 'devnet';
  const programId = projectContext.details?.projectState?.programId;

  useEffect(() => {
    setProjectName(projectContext.name || "My Token Project");
  }, [projectContext.name]);

  // Initialize network state if not set
  useEffect(() => {
    if (!projectContext.deployNetwork) {
      setProjectContext(prev => ({ ...prev, deployNetwork: 'devnet' }));
    }
  }, []);

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
    if (isBuilding) return;

    const projectId = projectContext.id
      ? projectContext.id
      : await ensureId(projectContext, setProjectContext);

    if (!projectId) {
      toast.error("Build error", { description: "Unable to determine project id" });
      return;
    }

    setIsBuilding(true);
    taskLogs.setSuppressToast(true);

    const graph = {
      nodes: projectContext.details?.projectState?.nodes || [],
      edges: projectContext.details?.projectState?.edges || [],
      config: projectContext.details?.projectState?.config || {},
    };

    try {
      esRef.current = deployPipeline(
        projectId,
        graph,
        (msg: any) => {
          if (msg.fileTree) {
            setFileTree(structuredClone(msg.fileTree));
            setActiveTab('code');
          }

          if (msg.containerUrl) {
            const fullUrl = msg.containerUrl.includes("/dapp/")
              ? msg.containerUrl
              : msg.containerUrl.replace(/\/$/, "") + `/dapp/${projectId}`;
            containerURLRef.current = fullUrl;
            setProjectContext(prev => ({ ...prev, containerUrl: fullUrl }));
          }

          if (IS_DEV_SERVER && (msg.stage === "ui-complete" || msg.event === "ui-complete")) {
            pollingCancelledRef.current = false;
            const containerUrl = containerURLRef.current;
            if (containerUrl) {
              const checkReady = (attempt: number = 1) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                fetch(containerUrl, { method: 'GET', mode: 'no-cors', signal: controller.signal }).then(() => {
                  clearTimeout(timeoutId);
                  setActiveTab('interface');
                }).catch(() => {
                  clearTimeout(timeoutId);
                  if (attempt < 60 && !pollingCancelledRef.current) {
                    setTimeout(() => checkReady(attempt + 1), 1000);
                  }
                });
              };
              checkReady();
            }
          }

          if (
            msg.stage === 'code-gen' &&
            typeof msg.message === 'string' &&
            msg.message.includes('Program ID')
          ) {
            const m = msg.message.match(/Program ID[: ]+([0-9A-Za-z]+)/);
            if (m) {
              const programId = m[1];
              setProjectContext(prev => ({
                ...prev,
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
        true
      );

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
  }, [isBuilding, projectContext, setProjectContext, setFileTree, setActiveTab, taskLogs]);

  const handleBuildClick = async () => {
    if (isBuilding) return;
    await handleConfirmBuild();
  };

  const handleDeployClick = useCallback(() => {
    if (!built) {
      toast.error('Please build first', {
        id: NEED_BUILD_TOAST_ID,
        duration: 4000,
      });
      return;
    }

    if (currentNetwork === 'local') {
      handleLocalDeploy();
    } else {
      setIsDeployModalOpen(true);
    }
  }, [built, currentNetwork]);

  const handleLocalDeploy = async () => {
    if (!projectContext.id || isLocalDeploying) return;
    
    setIsLocalDeploying(true);
    
    try {
      const response = await projectApi.quickDeployLocal(projectContext.id, {
        walletPubkey: undefined, // Removed wallet dependency
        resetValidator: false
      });
      
      if (response.data.programId) {
        toast.success('Program deployed to local validator!', {
          description: `Program ID: ${response.data.programId.slice(0, 16)}...`,
        });
        
        handleDeploySuccess(response.data.programId);
      }
    } catch (error) {
      console.error('Local deployment error:', error);
      toast.error('Local deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLocalDeploying(false);
    }
  };

  const handleDeploySuccess = useCallback((programId: string) => {
    if (projectContext.details?.projectState) {
      const updatedContext = {
        ...projectContext,
        details: {
          ...projectContext.details,
          projectState: {
            ...projectContext.details.projectState,
            deployed: true,
            built: false,
            programId: programId
          }
        }
      };

      if (projectContext.containerUrl) {
        const sep = projectContext.containerUrl.includes('?') ? '&' : '?';
        updatedContext.containerUrl = `${projectContext.containerUrl}${sep}programId=${programId}`;
      }

      setProjectContext(updatedContext);

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

    setIsDeployModalOpen(false);
  }, [projectContext, setProjectContext]);

  const handleNetworkChange = async (network: 'local' | 'devnet' | 'mainnet') => {
    if (network === 'mainnet') return;
    
    try {
      // Handle local network setup
      if (network === 'local' && projectContext.id) {
        // First, try to get existing ports
        let actualPort = '8899'; // Default fallback
        
        try {
          const portsResponse = await projectApi.getProjectPorts(projectContext.id);
          console.log('[ChatHeader] Ports response:', portsResponse);
          
          if (portsResponse.data?.rpc) {
            actualPort = portsResponse.data.rpc.toString();
            console.log(`[ChatHeader] Using existing port: ${actualPort}`);
          } else {
            console.log('[ChatHeader] No custom ports found, will start validator on default');
          }
        } catch (error) {
          console.log('[ChatHeader] Could not get ports, will use defaults');
        }
        
        // Set the port BEFORE starting validator
        connectionManager.setLocalValidatorPort(actualPort);
        
        // Start/verify validator
        try {
          toast.info('Starting local validator...', {
            duration: Infinity,
            id: 'validator-starting'
          });
          
          const response = await projectApi.startLocalValidator(projectContext.id, { 
            reset: false 
          });
          
          toast.dismiss('validator-starting');
          
          // Update port if different from response
          if (response.data?.rpcUrl) {
            const url = new URL(response.data.rpcUrl);
            const rpcPort = url.port || actualPort;
            if (rpcPort !== actualPort) {
              console.log(`[ChatHeader] Updating port from validator response: ${rpcPort}`);
              connectionManager.setLocalValidatorPort(rpcPort);
              actualPort = rpcPort;
            }
          }
          
          if (response.data?.validatorRunning) {
            // Give validator time to fully initialize
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success('Local validator started');
          } else {
            toast.warning('Local validator may not be running');
          }
        } catch (error) {
          toast.dismiss('validator-starting');
          console.error('Failed to start validator:', error);
          toast.warning('Local validator may not be running');
        }
        
        // Clear connection cache before switching
        connectionManager.clearConnectionCache();
      }
      
      // Update project context
      setProjectContext(prev => ({ ...prev, deployNetwork: network }));
      
      // Switch cluster
      const switched = await connectionManager.switchCluster(network);
      
      if (switched) {
        if (projectContext.id) {
          await projectApi.switchCluster(projectContext.id, { cluster: network });
        }
        toast.success(`Switched to ${network === 'local' ? 'Local Validator' : 'Devnet'}`);
      } else if (network === 'local') {
        toast.error('Failed to connect to local validator. Please ensure it is running.');
      }
    } catch (error) {
      console.error('Cluster switch error:', error);
      toast.error(`Failed to switch to ${network}`);
    }
  };

  const handleWalletClick = async () => {
    try {
      if (!connected) {
        await select(PhantomWalletName);
        await connect();
      } else {
        await disconnect();
      }
    } catch (error) {
      console.error("Wallet connect error:", error);
    }
  };

  const handleCopyProgramId = () => {
    if (programId) {
      navigator.clipboard.writeText(programId);
      toast.success('Program ID copied to clipboard');
    }
  };


  useEffect(() => {
    const run = () => {
      if (isBuilding) return;
      taskLogs.setSuppressToast(true);
      handleConfirmBuild();
    };
    eventBus.on('chat-build-command', run);
    return () => eventBus.off('chat-build-command', run);
  }, [handleConfirmBuild, isBuilding, taskLogs]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);
  
  // Initialize local validator port on component mount if we have a project
  useEffect(() => {
    const initializeLocalPort = async () => {
      if (projectContext.id) {
        try {
          // Always get the project's container ports, regardless of current network
          const response = await projectApi.getProjectPorts(projectContext.id);
          if (response.data?.rpc) {
            console.log(`[ChatHeader] Setting local validator port to ${response.data.rpc}`);
            connectionManager.setLocalValidatorPort(response.data.rpc.toString());
            
            // If we're already on local network, update the connection immediately
            if (projectContext.deployNetwork === 'local') {
              await connectionManager.switchCluster('local');
            }
          }
        } catch (error) {
          console.error('Failed to get project ports:', error);
        }
      }
    };
    
    initializeLocalPort();
  }, [projectContext.id, projectContext.deployNetwork]);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        {/* Left side - Project name and Program ID */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="bg-muted px-2 py-1 rounded-md text-sm font-medium w-48 focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="text-sm font-medium truncate max-w-[200px] cursor-pointer hover:text-primary"
                onClick={() => setIsEditing(true)}
              >
                {projectName}
              </div>
            )}
            <TooltipProvider delayDuration={0} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 cursor-pointer"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <span>Edit name</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Program ID display */}
          {programId && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <Code2 className="h-3.5 w-3.5 text-primary/70" />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Program ID</span>
                <span className="text-xs font-mono text-foreground/90">
                  {programId.slice(0, 8)}...{programId.slice(-6)}
                </span>
              </div>
              <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 ml-1 hover:bg-primary/10 cursor-pointer"
                      onClick={handleCopyProgramId}
                    >
                      <Copy className="h-3 w-3 text-primary/70" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    <span>Copy full Program ID</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Center - Project action buttons */}
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            {/* Open */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 cursor-pointer"
                  onClick={handleOpenProjectClick}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>Open</span>
              </TooltipContent>
            </Tooltip>

            {/* Save */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("h-8 w-8", projectContext.id ? "cursor-pointer" : "cursor-default")}
                  onClick={handleSaveProject}
                  disabled={!projectContext.id}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>{projectContext.id ? "Save" : "Save (project not created)"}</span>
              </TooltipContent>
            </Tooltip>

            {/* New */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 cursor-pointer"
                  onClick={handleNewProject}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>New</span>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Build */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("h-8 w-8", isBuilding ? "cursor-default" : "cursor-pointer")}
                  onClick={handleBuildClick}
                  disabled={isBuilding}
                >
                  {isBuilding ? (
                    <PulseLoader color="currentColor" size={4} />
                  ) : (
                    <Hammer className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>{isBuilding ? "Building..." : "Build"}</span>
              </TooltipContent>
            </Tooltip>

            {/* Deploy */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("h-8 w-8", (!built || isLocalDeploying) ? "cursor-default" : "cursor-pointer")}
                  onClick={handleDeployClick}
                  disabled={!built || isLocalDeploying}
                >
                  {isLocalDeploying ? (
                    <PulseLoader color="currentColor" size={4} />
                  ) : (
                    <Rocket className={projectDeployed ? "h-4 w-4 text-green-500" : "h-4 w-4"} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>
                  {!built 
                    ? "Build first to deploy"
                    : isLocalDeploying
                    ? "Deploying..."
                    : projectDeployed 
                    ? "Deployed" 
                    : "Deploy"}
                </span>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Network Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-8 w-8 cursor-pointer",
                        currentNetwork === 'local' && "text-green-500 hover:text-green-600",
                        currentNetwork === 'devnet' && "text-blue-500 hover:text-blue-600",
                        currentNetwork === 'mainnet' && "text-orange-500 hover:text-orange-600"
                      )}
                    >
                      <Network className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <span>{currentNetwork === 'local' ? 'Localnet' : currentNetwork === 'mainnet' ? 'Mainnet' : 'Devnet'}</span>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem 
                  onClick={() => handleNetworkChange('devnet')}
                  className={cn(
                    "cursor-pointer flex items-center justify-between",
                    currentNetwork === 'devnet' && "bg-accent"
                  )}
                >
                  <span>Devnet</span>
                  {currentNetwork === 'devnet' && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleNetworkChange('local')}
                  className={cn(
                    "cursor-pointer flex items-center justify-between",
                    currentNetwork === 'local' && "bg-accent"
                  )}
                >
                  <span>Localnet</span>
                  {currentNetwork === 'local' && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  disabled
                  className="cursor-not-allowed opacity-50 flex items-center justify-between"
                >
                  <span>Mainnet</span>
                  {currentNetwork === 'mainnet' && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>

        {/* Right side - Wallet and Delete button */}
        <div className="flex items-center gap-2">
          {/* Wallet Connection */}
          {connected ? (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={handleWalletClick}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-foreground">
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </span>
            </div>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 rounded-full px-3 text-xs shadow-sm hover:shadow-md transition-shadow bg-transparent cursor-pointer"
              onClick={handleWalletClick}
            >
              Connect Wallet
            </Button>
          )}

          {/* Delete Chat Button */}
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  onClick={onDeleteChat}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <span>Clear chat</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Modals */}
      <NewProjectModal
        open={isNewProjectModalOpen}
        onOpenChange={setIsNewProjectModalOpen}
        onSubmit={handleCreateProject}
      />

      {isDeployModalOpen && projectContext.id && currentNetwork === 'devnet' && (
        <ProgramDeployer
          projectId={projectContext.id}
          isOpen={isDeployModalOpen}
          onClose={() => setIsDeployModalOpen(false)}
          onSuccess={handleDeploySuccess}
        />
      )}

      <Dialog open={isProjectListModalOpen} onOpenChange={setIsProjectListModalOpen}>
        <DialogContent aria-describedby="project-list-desc">
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
    </>
  );
}