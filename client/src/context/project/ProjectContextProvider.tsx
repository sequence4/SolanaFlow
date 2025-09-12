"use client";

import React, { useState, useEffect } from 'react';
import ProjectContext, { IProjectContextValue } from './ProjectContext';
import { ProjectContextType, ProjectStateType, ProjectStateUpdater } from './ProjectContextTypes';

// Default context that doesn't depend on localStorage
const defaultContext: ProjectContextType = {
  id: '',
  name: '',
  description: '',
  containerUrl: '',
  injectingNodeTypes: [],
  details: {
    programId: undefined, // Add programId at details level
    setProjectState: () => {},
    projectState: {
      nodes: [],
      edges: [],
      config: {},
      instructions: [],
      projectFiles: { lib: '', mod: '', state: '' },
      deployed: false,
      built: false,
    },
  },
};

const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with defaultContext - no localStorage call at module level
  const [projectContext, setProjectContext] = useState<ProjectContextType>(defaultContext);

  // Load data from localStorage only after component mounts (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('projectContext');
      
      if (stored) {
        console.log(`[DEBUG] Loading from localStorage, raw data:`, stored);
        const parsed = JSON.parse(stored);
        console.log(`[DEBUG] Parsed localStorage data:`, parsed);
        console.log(`[DEBUG] containerUrl from localStorage:`, parsed.containerUrl);
  
        setProjectContext({
          id: parsed.id || '',
          name: parsed.name || '',
          description: parsed.description || '',
          containerUrl: parsed.containerUrl || '',
          injectingNodeTypes: parsed.injectingNodeTypes || [],
          details: {
            programId: parsed.details?.programId || null,
            setProjectState: () => {}, // Will be replaced in the next useEffect
            projectState: {
              nodes: parsed?.details?.projectState?.nodes || [],
              edges: parsed?.details?.projectState?.edges || [],
              config: parsed?.details?.projectState?.config || {},
              instructions: parsed?.details?.projectState?.instructions || [],
              projectFiles: parsed?.details?.projectState?.projectFiles || { lib: '', mod: '', state: '' },
              programId: parsed?.details?.projectState?.programId || null,
              deployed: parsed?.details?.projectState?.deployed || false,
              built: parsed?.details?.projectState?.built || false,
            },
          },
        });
      } else {
        console.log(`[DEBUG] No projectContext in localStorage, using default context`);
      }
    } catch (error) {
      console.error('Error parsing projectContext from localStorage:', error);
    }
  }, []);

  const handleSetProjectState = (newStateOrUpdater: ProjectStateUpdater) => {
    setProjectContext((prev) => {
      const oldState = prev.details?.projectState || {
        nodes: [],
        edges: [],
        config: {},
        instructions: [],
        projectFiles: { lib: '', mod: '', state: '' },
        built: false,
        deployed: false,
      };
      
      const newState =
        typeof newStateOrUpdater === 'function'
          ? newStateOrUpdater(oldState)
          : newStateOrUpdater;

      return {
        ...prev,
        details: {
          ...prev.details!,
          projectState: newState,
          programId: prev.details?.programId || undefined, // Preserve programId
        },
      };
    });
  };

  useEffect(() => {
    setProjectContext((prev) => {
      // Create a default projectState if prev.details is undefined
      const defaultProjectState: ProjectStateType = {
        nodes: [],
        edges: [],
        config: {},
        instructions: [],
        projectFiles: { lib: '', mod: '', state: '' },
        deployed: false,
        built: false,
      };

      // Ensure details is not undefined with proper projectState
      const details = prev.details || { 
        projectState: defaultProjectState,
        programId: undefined 
      };

      return {
        ...prev,
        details: {
          ...details,
          setProjectState: handleSetProjectState,
          projectState: details.projectState,
          programId: details.programId || undefined,
        },
      };
    });
  }, []);

  // Save to localStorage whenever projectContext changes
  useEffect(() => {
    try {
      const { id, name, description, details, containerUrl, injectingNodeTypes } = projectContext;
      console.log(`[DEBUG] Saving to localStorage, containerUrl: "${containerUrl}"`);
      
      const dataToStore = {
        id,
        name,
        description,
        containerUrl,
        injectingNodeTypes,
        details: {
          projectState: details?.projectState,
          setProjectState: details?.setProjectState || (() => {}),
          programId: details?.programId || null, // Save programId
        },
      };
      
      console.log(`[DEBUG] Data being stored in localStorage:`, dataToStore);
      localStorage.setItem('projectContext', JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Error saving projectContext to localStorage:', error);
    }
  }, [projectContext]);

  const value: IProjectContextValue = {
    projectContext,
    setProjectContext,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export default ProjectProvider;
