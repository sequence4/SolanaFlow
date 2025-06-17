import React, { useState, useContext, memo } from "react";
import { FileTreeItemType } from "@/interfaces/FileTreeItemType";
import FileContext from "@/context/file/FileContext";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import FileArrivalTicker from "./FileArrivalTicker";

/* ---------- recursive leaf ---------- */
const TreeItem = memo(({ node, level = 0 }: { node: FileTreeItemType; level?: number }) => {
  const { setSelectedFile } = useContext(FileContext);
  const [open, setOpen] = useState(level < 1 || node.name === "anchor-template");               // root folders open + anchor template

  const indent = { paddingLeft: `${level * 1.0}rem` };

  if (node.type === "file") {
    return (
      <div
        role="treeitem"
        tabIndex={0}
        className="flex items-center h-6 pl-1 pr-2 cursor-pointer hover:bg-[#2a2a2d]"
        style={indent}
        onClick={() => setSelectedFile(node)}
        onKeyDown={e => { if (e.key === "Enter") setSelectedFile(node); }}
      >
        <FileText className="h-4 w-4 mr-1 text-[#9ca3af]" />
        <span className="truncate text-xs">{node.name}</span>
      </div>
    );
  }

  /* directory */
  return (
    <div role={level === 0 ? "tree" : "group"}>
      <div
        role="treeitem"
        aria-expanded={open}
        tabIndex={0}
        className="flex items-center h-6 pl-1 pr-2 cursor-pointer hover:bg-[#2a2a2d] select-none"
        style={indent}
        onClick={() => setOpen(!open)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 mr-1 text-[#9ca3af]" />
        ) : (
          <ChevronRight className="h-4 w-4 mr-1 text-[#9ca3af]" />
        )}
        <Folder className="h-4 w-4 mr-1 text-[#eab308]" />
        <span className="truncate text-xs font-medium">{node.name}</span>
      </div>
      {open && node.children?.map(child => (
        <TreeItem key={child.path} node={child} level={level + 1} />
      ))}
    </div>
  );
});

export default function FileExplorer() {
  const { fileTree } = useContext(FileContext);

  if (!fileTree) return (
    <div className="text-xs text-center text-[#6e6e76] pt-4">
      No files yet
    </div>
  );

  /* fileTree root may be array or object ⇒ normalise to array */
  const roots: FileTreeItemType[] = Array.isArray(fileTree) ? fileTree : [fileTree];

  return (
    <>
      <div className="h-full overflow-y-auto bg-[#1e1e20] border-r border-[#2a2a2d]">
        {roots.map(node => (
          <TreeItem key={node.path ?? node.name} node={node} />
        ))}
      </div>
      {/* ticker overlay */}
      <FileArrivalTicker />
    </>
  );
} 