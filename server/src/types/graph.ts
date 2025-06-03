/**
 * Canonical graph data model used by the deploy pipeline.
 * --------------------------------------------------------
 * Each workspace keeps its **own** copy so we never rely on
 * cross-workspace imports (pnpm linking issues ⬅ your earlier error).
 */

export interface GraphNode {
    /** Unique identifier – must be stable across edits */
    id: string;
  
    /** Semantic kind of node, e.g. "fetch", "transform", "db-write" */
    type: string;
  
    /** Arbitrary, node-specific configuration */
    config: Record<string, unknown>;
  }
  
  export interface GraphEdge {
    /** Unique identifier for the edge */
    id: string;
  
    /** `id` of the upstream node */
    from: string;
  
    /** `id` of the downstream node */
    to: string;
  }
  
  /**
   * The graph sent from the client:
   *  - `nodes` is mandatory and must contain at least one element.
   *  - `edges` is optional (not every pipeline needs explicit edges).
   */
  export interface Graph {
    nodes: GraphNode[];
    edges?: GraphEdge[];
  }
  
  /**
   * Request body for the deploy pipeline endpoint
   */
  export interface DeployPipelineRequestBody {
    graph: Graph;
    walletSigned?: boolean;
  }
  