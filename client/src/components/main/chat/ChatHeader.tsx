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
  Globe,
  HardDrive,
  ChevronDown,
  Wallet
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
import { useWalletSigner } from '@/utils/blockchain/wallet';
import { useWallet } from '@solana/wallet-adapter-react';
import { PhantomWalletName } from '@solana/wallet-adapter-phantom';
import { ensureId } from '@/utils/project/ensureId';
import { ProgramDeployer } from '@/components/ProgramDeployer';
import { projectApi } from '@/api/projectApi';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import eventBus from '@/lib/eventBus';
import { NewProjectModal } from '@/components/ui/new-project-modal';
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import ProjectListPopover from '@/components/main/workflow/ProjectListPopover';
import { connectionManager } from '@/utils/blockchain/connectionManager';

const WALLET_TOAST_ID = 'wallet-not-connected';
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
  const [currentCluster, setCurrentCluster] = useState<'local' | 'devnet' | 'mainnet'>('devnet');
  const [isLocalDeploying, setIsLocalDeploying] = useState(false);
  
  const walletSigner = useWalletSigner();
  const { connected, publicKey, connect, disconnect, select } = useWallet();
  const taskLogs = useTaskLogs();
  const esRef = useRef<ReturnType<typeof deployPipeline> | null>(null);
  const containerURLRef = useRef<string | null>(null);
  const pollingCancelledRef = useRef<boolean>(false);
  
  const projectDeployed = !!projectContext?.details?.projectState?.deployed;
  const built = !!projectContext.details?.projectState?.built;

  useEffect(() => {
    setProjectName(projectContext.name || "My Token Project");
  }, [projectContext.name]);

  // Subscribe to cluster changes and update project context
  useEffect(() => {
    const unsubscribe = connectionManager.onClusterChange((cluster) => {
      const networkCluster = cluster === 'local' ? 'local' : cluster === 'mainnet-beta' ? 'mainnet' : 'devnet';
      setCurrentCluster(networkCluster);
      setProjectContext(prev => ({ ...prev, deployNetwork: networkCluster }));
    });
    
    // Set initial value
    const initialCluster = connectionManager.getCurrentCluster();
    const initialNetwork = initialCluster === 'local' ? 'local' : initialCluster === 'mainnet-beta' ? 'mainnet' : 'devnet';
    setCurrentCluster(initialNetwork);
    if (!projectContext.deployNetwork) {
      setProjectContext(prev => ({ ...prev, deployNetwork: initialNetwork }));
    }
    
    return unsubscribe;
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
    if (!walletSigner.isConnected) {
      toast.error('Please connect your wallet first', {
        id: WALLET_TOAST_ID,
        duration: 4000,
      });
      return;
    }

    if (!built) {
      toast.error('Please build first', {
        id: NEED_BUILD_TOAST_ID,
        duration: 4000,
      });
      return;
    }

    if (currentCluster === 'local') {
      handleLocalDeploy();
    } else {
      setIsDeployModalOpen(true);
    }
  }, [walletSigner.isConnected, built, currentCluster]);

  const handleLocalDeploy = async () => {
    if (!projectContext.id || isLocalDeploying) return;
    
    setIsLocalDeploying(true);
    
    try {
      const response = await projectApi.quickDeployLocal(projectContext.id, {
        walletPubkey: walletSigner.publicKey?.toBase58(),
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

  const handleWalletClick = async () => {
    try {
      if (!connected) {
        select(PhantomWalletName);
        await connect();
      } else {
        await disconnect();
      }
    } catch (error) {
      console.error("Wallet connect error:", error);
    }
  };

  const handleNetworkChange = async (network: 'local' | 'devnet' | 'mainnet') => {
    if (network === 'mainnet') return; // Mainnet is disabled
    
    const targetCluster = network;
    
    try {
      const switched = await connectionManager.switchCluster(targetCluster);
      
      if (switched) {
        setCurrentCluster(targetCluster);
        setProjectContext(prev => ({ ...prev, deployNetwork: targetCluster }));
        
        if (projectContext.id) {
          await projectApi.switchCluster(projectContext.id, { cluster: targetCluster });
        }
        
        toast.success(`Switched to ${targetCluster === 'local' ? 'Local Validator' : 'Devnet'}`);
      }
    } catch (error) {
      console.error('Cluster switch error:', error);
      toast.error(`Failed to switch to ${network}`);
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
    return () => esRef.current?.close();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        {/* Left side - Project name */}
        <div className="flex items-center gap-2">
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
                  className={cn("h-8 w-8", (!walletSigner.isConnected || !built || isLocalDeploying) ? "cursor-default" : "cursor-pointer")}
                  onClick={handleDeployClick}
                  disabled={!walletSigner.isConnected || !built || isLocalDeploying}
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
                  {!walletSigner.isConnected 
                    ? "Connect wallet to deploy" 
                    : !built 
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
                        "h-8 w-8 cursor-pointer relative",
                        currentCluster === 'local' 
                          ? "text-green-500 hover:text-green-600" 
                          : currentCluster === 'mainnet'
                          ? "text-orange-500 hover:text-orange-600"
                          : "text-blue-500 hover:text-blue-600"
                      )}
                    >
                      {currentCluster === 'local' ? (
                        <HardDrive className="h-4 w-4" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                      <ChevronDown className="h-2 w-2 absolute bottom-1 right-1" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <span>{currentCluster === 'local' ? 'Local Validator' : currentCluster === 'mainnet' ? 'Mainnet' : 'Devnet'}</span>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem 
                  onClick={() => handleNetworkChange('devnet')}
                  className={cn(
                    "cursor-pointer",
                    currentCluster === 'devnet' && "bg-accent"
                  )}
                >
                  <Globe className="mr-2 h-4 w-4 text-blue-500" />
                  Devnet
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleNetworkChange('local')}
                  className={cn(
                    "cursor-pointer",
                    currentCluster === 'local' && "bg-accent"
                  )}
                >
                  <HardDrive className="mr-2 h-4 w-4 text-green-500" />
                  Localnet
                </DropdownMenuItem>
                <DropdownMenuItem 
                  disabled
                  className="cursor-not-allowed opacity-50"
                >
                  <Globe className="mr-2 h-4 w-4 text-orange-500" />
                  Mainnet (Disabled)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>

        {/* Right side - Wallet connect and Delete button */}
        <div className="flex items-center gap-2">
          {/* Wallet Connection */}
          {connected && publicKey ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 flex items-center gap-2 bg-muted/50 hover:bg-muted text-foreground border-none cursor-pointer"
              onClick={handleWalletClick}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium">
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </span>
            </Button>
          ) : (
            <TooltipProvider delayDuration={0} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3 flex items-center gap-2 bg-muted/50 hover:bg-muted text-foreground border-border cursor-pointer"
                    onClick={handleWalletClick}
                  >
                    <Wallet className="h-3 w-3" />
                    <span className="text-xs font-medium">Connect</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <span>Connect Wallet</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

      {isDeployModalOpen && projectContext.id && currentCluster === 'devnet' && (
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