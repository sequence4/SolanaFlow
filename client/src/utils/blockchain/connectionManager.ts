import { Connection, Commitment } from '@solana/web3.js';

export type ClusterType = 'local' | 'devnet' | 'testnet' | 'mainnet';

interface ClusterConfig {
  url: string;
  websocket?: string;
  label: string;
}

const CLUSTER_CONFIGS: Record<ClusterType, ClusterConfig> = {
  local: {
    url: 'http://localhost:8899',
    websocket: 'ws://localhost:8900',
    label: 'Local Validator'
  },
  devnet: {
    url: 'https://api.devnet.solana.com',
    websocket: undefined, // Will be auto-derived
    label: 'Devnet'
  },
  testnet: {
    url: 'https://api.testnet.solana.com',
    websocket: undefined,
    label: 'Testnet'
  },
  mainnet: {
    url: 'https://api.mainnet-beta.solana.com',
    websocket: undefined,
    label: 'Mainnet'
  }
};

class ConnectionManager {
  private static instance: ConnectionManager;
  private connections: Map<string, Connection> = new Map();
  private currentCluster: ClusterType = 'devnet';
  private listeners: ((cluster: ClusterType) => void)[] = [];
  private localValidatorPort: string = '8899'; // Dynamic port for local validator
  
  private constructor() {
    // Initialize with saved preference or default
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('preferred-cluster') as ClusterType;
      if (saved && CLUSTER_CONFIGS[saved]) {
        this.currentCluster = saved;
      }
    }
  }
  
  setLocalValidatorPort(port: string) {
    this.localValidatorPort = port;
    // Update the local cluster config
    CLUSTER_CONFIGS.local.url = `http://localhost:${port}`;
    CLUSTER_CONFIGS.local.websocket = `ws://localhost:${parseInt(port) + 1}`;
    // Clear cached connections for local cluster
    for (const [key] of this.connections) {
      if (key.includes('localhost')) {
        this.connections.delete(key);
      }
    }
    console.log(`[ConnectionManager] Local validator port set to ${port}`);
  }
  
  getLocalValidatorPort(): string {
    return this.localValidatorPort;
  }
  
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  getConnection(commitment: Commitment = 'confirmed'): Connection {
    // For local cluster, always use the current dynamic port
    const config = this.currentCluster === 'local' ? 
      {
        ...CLUSTER_CONFIGS[this.currentCluster],
        url: `http://localhost:${this.localValidatorPort}`,
        websocket: `ws://localhost:${parseInt(this.localValidatorPort) + 1}`
      } : 
      CLUSTER_CONFIGS[this.currentCluster];
    
    const key = `${config.url}-${commitment}`;
    
    if (!this.connections.has(key)) {
      this.connections.set(key, new Connection(config.url, {
        commitment,
        wsEndpoint: config.websocket,
        disableRetryOnRateLimit: true,
        confirmTransactionInitialTimeout: 30000
      }));
    }
    
    return this.connections.get(key)!;
  }
  
  getCurrentCluster(): ClusterType {
    return this.currentCluster;
  }
  
  getClusterConfig(): ClusterConfig {
    return CLUSTER_CONFIGS[this.currentCluster];
  }
  
  async switchCluster(cluster: ClusterType): Promise<boolean> {
    const config = CLUSTER_CONFIGS[cluster];
    if (!config) {
      console.error(`Invalid cluster: ${cluster}`);
      return false;
    }
    
    // Special handling for local cluster
    if (cluster === 'local') {
      console.log(`[ConnectionManager] Switching to local cluster with port ${this.localValidatorPort}`);
      // Skip validator check if we're still on default port (port not set yet)
      // The port will be set by ChatHeader before calling this
      if (this.localValidatorPort !== '8899') {
        // Only check if validator is running if we have a custom port set
        const isRunning = await this.isLocalValidatorRunning();
        if (!isRunning) {
          console.warn('Local validator is not accessible on port', this.localValidatorPort);
          // Don't switch if local validator isn't running
          return false;
        }
      } else {
        console.log('[ConnectionManager] Skipping validator check - using default port');
      }
    }
    
    try {
      // For local cluster, make sure we're using the updated URL with the correct port
      const connectionUrl = cluster === 'local' ? 
        `http://localhost:${this.localValidatorPort}` : 
        config.url;
      
      // Test connection with timeout
      const testConn = new Connection(connectionUrl, {
        commitment: 'confirmed',
        wsEndpoint: config.websocket,
        disableRetryOnRateLimit: true
      });
      
      const timeoutMs = cluster === 'local' ? 3000 : 5000;
      const version = await Promise.race([
        testConn.getVersion(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        )
      ]);
      
      if (!version) {
        throw new Error('Failed to get version');
      }
      
      // Connection successful, switch
      this.currentCluster = cluster;
      
      // Save preference
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('preferred-cluster', cluster);
      }
      
      // Clear connection cache
      this.connections.clear();
      
      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(cluster);
        } catch (e) {
          console.error('Listener error:', e);
        }
      });
      
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to connect to ${cluster}: ${errorMsg}`);
      
      // If local cluster fails, provide helpful message
      if (cluster === 'local') {
        console.info('Tip: Ensure local validator is running with: solana-test-validator');
      }
      
      return false;
    }
  }
  
  onClusterChange(listener: (cluster: ClusterType) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  async isLocalValidatorRunning(): Promise<boolean> {
    try {
      // Use the configured local validator port
      const url = `http://localhost:${this.localValidatorPort}`;
      const conn = new Connection(url, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true
      });
      
      const version = await Promise.race([
        conn.getVersion(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
      ]);
      
      return !!version;
    } catch {
      return false;
    }
  }
  
  // Helper to get all available clusters
  getAvailableClusters(): ClusterType[] {
    return Object.keys(CLUSTER_CONFIGS) as ClusterType[];
  }
  
  // Get cluster label for UI
  getClusterLabel(cluster?: ClusterType): string {
    const c = cluster || this.currentCluster;
    return CLUSTER_CONFIGS[c]?.label || c;
  }
}

export const connectionManager = ConnectionManager.getInstance();