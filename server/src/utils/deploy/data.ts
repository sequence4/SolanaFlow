import { Graph } from "../../types/graph";

export const MAX_BUILD_MINUTES = Number(process.env.MAX_BUILD_MINUTES) || 15;

export interface PipelineArgs {
  projectId: string;
  userId: string;
  graph: Graph; 
  sendProgress: (data: unknown) => void;
  walletSigned?: boolean;
  devMode?: boolean;
}