import { useState } from 'react';
import { projectApi } from '@/api/projectApi';
import { ProjectContextType } from '@/context/project/ProjectContextTypes';
import React from 'react';

export function useEnsureProjectId(
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>
) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingResolve, setPendingResolve] = useState<(id: string)=>void>();

  function ensureId(): Promise<string> {
    if (projectContext.id) return Promise.resolve(projectContext.id);

    setModalOpen(true);
    return new Promise<string>((resolve) => setPendingResolve(() => resolve));
  }

  async function handleModalSubmit({ name, description }: { name: string; description: string }) {
    const response = await projectApi.createProject({ name, description });
    const id = response.project.id;
    
    setProjectContext((prevState: ProjectContextType) => ({ 
      ...prevState, 
      id, 
      name 
    }));
    
    setModalOpen(false);
    pendingResolve?.(id);
  }

  return { ensureId, modalOpen, setModalOpen, handleModalSubmit };
}
