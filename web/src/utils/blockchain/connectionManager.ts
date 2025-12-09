import { Connection, Commitment } from '@solana/web3.js';
import { getClusterConfig, ClusterType } from '../cluster';

class ConnectionManager {
  private static instance: ConnectionManager;
  private connections: Map<string, Connection> = new Map();
  private currentCluster: ClusterType = 'devnet';
  private currentProjectId: string | null = null;
  private portsCache: { rpc: number, ws: number, faucet: number } | null = null;
  private listeners: ((cluster: ClusterType) => void)[] = [];
  
  private constructor() {
    // Initialize with saved preference or default
    const saved = localStorage.getItem('preferred-cluster') as ClusterType;
    this.currentCluster = saved || 'devnet';
  }
  
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  getConnection(commitment: Commitment = 'confirmed'): Connection {
    let config = getClusterConfig();
    
    // Override URL if local and we have cached ports
    if (this.currentCluster === 'local' && this.portsCache) {
      config = {
        ...config,
        url: `http://localhost:${this.portsCache.rpc}`,
        websocket: `ws://localhost:${this.portsCache.ws}`
      };
    }
    
    const key = `${config.url}-${commitment}`;
    
    if (!this.connections.has(key)) {
      this.connections.set(key, new Connection(config.url, {
        commitment,
        wsEndpoint: config.websocket
      }));
    }
    
    return this.connections.get(key)!;
  }
  
  private getCachedPorts() {
    return this.portsCache;
  }
  
  getCurrentCluster(): ClusterType {
    return this.currentCluster;
  }
  
  async getProjectPorts(projectId?: string): Promise<{ rpc: number, ws: number, faucet: number }> {
    if (projectId || this.currentProjectId) {
      try {
        const response = await fetch(`/api/projects/${projectId || this.currentProjectId}/ports`);
        if (response.ok) {
          const data = await response.json();
          this.portsCache = data.ports; // Cache the ports
          return data.ports;
        }
      } catch (e) {
        console.warn('Failed to fetch project ports, using defaults');
      }
    }
    
    // Fallback
    const fallback = { rpc: 28899, ws: 28900, faucet: 28901 };
    this.portsCache = fallback;
    return fallback;
  }
  
  async switchCluster(cluster: ClusterType, projectId?: string): Promise<boolean> {
    // Store the projectId for future use
    if (projectId) {
      this.currentProjectId = projectId;
    }
    
    // Test connection first
    let testUrl: string;
    
    if (cluster === 'local' && (projectId || this.currentProjectId)) {
      const effectiveProjectId = projectId || this.currentProjectId;
      if (effectiveProjectId) {
        const ports = await this.getProjectPorts(effectiveProjectId);
        testUrl = `http://localhost:${ports.rpc}`;
      } else {
        testUrl = 'http://localhost:28899';
      }
    } else {
      testUrl = cluster === 'local' ? 'http://localhost:28899' : 
                cluster === 'devnet' ? 'https://api.devnet.solana.com' :
                cluster === 'testnet' ? 'https://api.testnet.solana.com' :
                'https://api.mainnet-beta.solana.com';
    }
    
    try {
      const testConn = new Connection(testUrl, 'confirmed');
      await testConn.getVersion();
      
      // Connection successful, switch
      this.currentCluster = cluster;
      localStorage.setItem('preferred-cluster', cluster);
      
      // Clear connection cache
      this.connections.clear();
      
      // Notify listeners
      this.listeners.forEach(listener => listener(cluster));
      
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${cluster}:`, error);
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
  
  async isLocalValidatorRunning(projectId?: string): Promise<boolean> {
    try {
      const ports = await this.getProjectPorts(projectId);
      const conn = new Connection(`http://localhost:${ports.rpc}`, 'confirmed');
      const version = await Promise.race([
        conn.getVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      return !!version;
    } catch {
      return false;
    }
  }
}

export const connectionManager = ConnectionManager.getInstance();