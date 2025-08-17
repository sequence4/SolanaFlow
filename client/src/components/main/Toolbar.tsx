import React, { useState, useContext, useEffect } from 'react';
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import UxContext from '@/context/ux/UxContext';
import { handleNewProjectClick } from '@/utils/project/projectUtils';
import { handleConfirmNewProject, handleOpenProject, handleSaveClick } from '@/utils/project/projectUtils';
import { useTaskLogs } from '@/context/logs/useTaskLogs';
import { Tooltip } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LuSave, LuPlus, LuSun, LuMoon } from "react-icons/lu";
import { FaRegFolderOpen } from "react-icons/fa";
import ProjectListPopover from './workflow/ProjectListPopover';
import '@/styles/toolbar/ToolbarStyle.css';
import { useColorModeValue, useColorMode } from '@/components/ui/color-mode';
import { NewProjectModal } from '@/components/ui/new-project-modal';

export const ProjectInfo: React.FC = () => {
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { fileTree, setFileTree, setSelectedFile } = useContext(FileContext);
    const { setUxOpenPanel } = useContext(UxContext);
    const [projectsRefreshCounter, setProjectsRefreshCounter] = useState(0);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isProjectListModalOpen, setIsProjectListModalOpen] = useState(false);
    const taskLogs = useTaskLogs();

    const buttonTextColor = useColorModeValue('var(--toolbar-button-text-light)', 'var(--toolbar-button-text-dark)');
    const { colorMode, toggleColorMode } = useColorMode();

    useEffect(() => {
        console.log('ProjectContext:', projectContext);
    }, [projectContext]);

    const handleNewProjectToggle = () => {
        handleNewProjectClick(
            setProjectContext,     // clears id, nodes, etc.
            projectContext,
            setFileTree,
            setSelectedFile
        );
        setIsNewProjectModalOpen(true);  // now open the modal
    };

    const handleCreateProject = (data: { name: string; description: string; repoUrl?: string }) => {
        // Reset logs before starting new project creation
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

    const handleOpenProjectClick = async () => {
        setIsProjectListModalOpen(true);
    };

    return (
        <div className="flex flex-1 flex-row justify-between w-full items-center p-[10px_25px] gap-[30px] text-[10px] bg-gradient-to-r from-slate-900/50 via-slate-800/30 to-slate-900/50 backdrop-blur-xl border-b border-white/10 shadow-lg"
        >
            <div className="flex flex-row gap-[20px] items-center justify-between min-w-[250px] w-full">
                <div className="flex flex-row gap-[20px] items-center justify-center">
                    {/* New Project Button */}
                    <Tooltip content="New Project">
                        <Button
                            variant="ghost"
                            onClick={handleNewProjectToggle}
                            className="flex items-center justify-center gap-[10px] text-sm rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                            style={{ color: buttonTextColor }}
                        >
                            <LuPlus size={18} />
                            <span>New</span>
                        </Button>
                    </Tooltip>

                    {/* Open Project Button */}
                    <Tooltip content="Open Project">
                        <Button
                            variant="ghost"
                            onClick={handleOpenProjectClick}
                            className="flex items-center justify-center gap-[10px] text-sm rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                            style={{ color: buttonTextColor }}
                        >
                            <FaRegFolderOpen size={18} />
                            <span>Open</span>
                        </Button>
                    </Tooltip>

                    {/* Save Project Button */}
                    <Tooltip content="Save Project">
                        <Button
                            variant="ghost"
                            onClick={() => handleSaveClick(projectContext, setProjectContext, projectsRefreshCounter, setProjectsRefreshCounter)}
                            className="flex items-center justify-center gap-[10px] text-sm rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 backdrop-blur-sm disabled:opacity-50"
                            style={{ color: buttonTextColor }}
                            disabled={!projectContext.id}
                        >
                            <LuSave size={18} />
                            <span>Save</span>
                        </Button>
                    </Tooltip>
                </div>
                
                {/* Theme Toggle Button */}
                <div className="flex items-center">
                    <Tooltip content={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}>
                        <Button
                            variant="ghost"
                            onClick={toggleColorMode}
                            className="flex items-center justify-center p-2 text-sm rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                            style={{ color: buttonTextColor }}
                        >
                            {colorMode === 'dark' ? <LuSun size={18} /> : <LuMoon size={18} />}
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* New Project Modal */}
            <NewProjectModal
                open={isNewProjectModalOpen}
                onOpenChange={setIsNewProjectModalOpen}
                onSubmit={handleCreateProject}
            />

            {/* Project List Modal */}
            <Dialog open={isProjectListModalOpen} onOpenChange={(open) => setIsProjectListModalOpen(open)}>
                <DialogContent className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-xl text-slate-100 border-white/10" 
                style={{width: "fit-content"}}>
                    <ProjectListPopover
                        modalIsOpen={isProjectListModalOpen}
                        refreshTrigger={projectsRefreshCounter}
                        onProjectClick={(projectId, projectName) => {
                            handleOpenProject(projectId, projectContext, setProjectContext, setFileTree);
                            setIsProjectListModalOpen(false);
                        }}
                        closePopover={() => setIsProjectListModalOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};
