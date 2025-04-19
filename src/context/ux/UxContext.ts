import { createContext } from 'react';
import {type UxContextType } from './UxContextTypes';

const UxContext = createContext<UxContextType>({
  uxOpenPanel: 'none',
  setUxOpenPanel: () => {},

  parentTab: 'program-builder',
  setParentTab: () => {},

  activeTab: 'workflow',
  setActiveTab: () => {},

  isChatOpen: false,
  setIsChatOpen: () => {},
});

export default UxContext;
