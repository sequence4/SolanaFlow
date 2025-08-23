import { Graph } from "src/types/graph";
import { WorkspaceHandle } from "../container/interfaces";

export interface Args {
    projectId: string;
    graph: Graph;
    workspace: WorkspaceHandle;
    sendProgress: (data: unknown) => void;
    userId: string;
}

export const allGeneratedFiles: Array<{filename: string, content: string, language: string}> = [];
