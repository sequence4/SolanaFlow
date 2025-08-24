import { Connection, Commitment } from '@solana/web3.js';
import { getClusterConfig, ClusterType } from '../cluster';

class ConnectionManager {
  private static instance: ConnectionManager;
  private connections: Map<string, Connection> = new Map();
  private currentCluster: ClusterType = 'devnet';
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
    const config = getClusterConfig();
    const key = `${config.url}-${commitment}`;
    
    if (!this.connections.has(key)) {
      this.connections.set(key, new Connection(config.url, {
        commitment,
        wsEndpoint: config.websocket
      }));
    }
    
    return this.connections.get(key)!;
  }
  
  getCurrentCluster(): ClusterType {
    return this.currentCluster;
  }
  
  async switchCluster(cluster: ClusterType): Promise<boolean> {
    // Test connection first
    const testUrl = cluster === 'local' ? 'http://localhost:18899' : 
                    cluster === 'devnet' ? 'https://api.devnet.solana.com' :
                    cluster === 'testnet' ? 'https://api.testnet.solana.com' :
                    'https://api.mainnet-beta.solana.com';
    
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
  
  async isLocalValidatorRunning(): Promise<boolean> {
    try {
      const conn = new Connection('http://localhost:18899', 'confirmed');
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