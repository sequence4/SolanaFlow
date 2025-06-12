import { FileTreeItemType } from "../../interfaces/FileTreeItemType";

export interface FileContextType {
  selectedFile: FileTreeItemType | null;
  setSelectedFile: (file: FileTreeItemType | null) => void;
  fileTree: FileTreeItemType | FileTreeItemType[] | null;
  setFileTree: (tree: FileTreeItemType | FileTreeItemType[] | null) => void;
  /** Raw UTF-8 contents of the currently selected file */
  content?: string;
}
