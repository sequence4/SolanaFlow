import { createContext } from "react";
import type { FileContextType } from "./FileContextTypes";

const FileContext = createContext<FileContextType>({
  selectedFile: null,
  setSelectedFile: () => {},
  fileTree: null,
  setFileTree: () => {},
});

export default FileContext;
