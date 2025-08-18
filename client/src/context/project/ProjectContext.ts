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
      programId: undefined, // Add programId at the details level
      projectState: {
        nodes: [],
        edges: [],
        config: {},
        instructions: [],
        projectFiles: { lib: '', mod: '', state: '' },
        built: false,
        deployed: false,
        idl: undefined,
        idls: [],
      },
      setProjectState: () => {},
    },
  },
  setProjectContext: () => {},
}

const ProjectContext = createContext<IProjectContextValue>(defaultValue)

export default ProjectContext
