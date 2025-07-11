import React,{ createContext } from 'react'
import { ProjectContextType } from './ProjectContextTypes'

export interface IProjectContextValue {
  projectContext: ProjectContextType
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>
}

const defaultValue: IProjectContextValue = {
  // Default (initial) project context
  projectContext: {
    id: '',
    name: '',
    description: '',
    containerUrl: '',
    injectingNodeTypes: [],
    details: {
      programId: null, // Add programId at the details level
      projectState: {
        mode: 'basic',
        nodes: [],
        edges: [],
        config: {},
        instructions: [],
        projectFiles: { lib: '', mod: '', state: '' },
        fileTree: undefined,
        built: false,
        deployed: false,
        idl: null,
        idls: [],
      },
      setProjectState: () => {},
    },
  },
  setProjectContext: () => {},
}

const ProjectContext = createContext<IProjectContextValue>(defaultValue)

export default ProjectContext
