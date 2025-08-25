import { Connection, clusterApiUrl } from '@solana/web3.js';

export type ClusterType = 'local' | 'devnet' | 'testnet' | 'mainnet-beta';

export interface ClusterConfig {
  type: ClusterType;
  url: string;
  websocket: string;
  name: string;
}

const CLUSTERS: Record<ClusterType, ClusterConfig> = {
  local: {
    type: 'local',
    url: 'http://localhost:28899',  // Default to dynamic port range
    websocket: 'ws://localhost:28900',
    name: 'Local Validator'
  },
  devnet: {
    type: 'devnet',
    url: clusterApiUrl('devnet'),
    websocket: 'wss://api.devnet.solana.com',
    name: 'Devnet'
  },
  testnet: {
    type: 'testnet',
    url: clusterApiUrl('testnet'),
    websocket: 'wss://api.testnet.solana.com',
    name: 'Testnet'
  },
  'mainnet-beta': {
    type: 'mainnet-beta',
    url: clusterApiUrl('mainnet-beta'),
    websocket: 'wss://api.mainnet-beta.solana.com',
    name: 'Mainnet Beta'
  }
};

export function getClusterConfig(): ClusterConfig {
  // Check environment variables first
  const envCluster = process.env.NEXT_PUBLIC_CLUSTER as ClusterType;
  if (envCluster && CLUSTERS[envCluster]) {
    return CLUSTERS[envCluster];
  }
  
  // Check localStorage for user preference
  const savedCluster = localStorage.getItem('preferred-cluster') as ClusterType;
  if (savedCluster && CLUSTERS[savedCluster]) {
    return CLUSTERS[savedCluster];
  }
  
  // Check if local validator is running (try default dynamic port)
  if (typeof window !== 'undefined') {
    fetch('http://localhost:28899', { method: 'POST', body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getHealth'
    })})
    .then(res => {
      if (res.ok) {
        console.log('Local validator detected, switching to local cluster');
        localStorage.setItem('preferred-cluster', 'local');
        window.location.reload();
      }
    })
    .catch(() => {/* Local validator not available */});
  }
  
  // Default to devnet
  return CLUSTERS.devnet;
}

export function createConnection(): Connection {
  const config = getClusterConfig();
  return new Connection(config.url, {
    commitment: 'confirmed',
    wsEndpoint: config.websocket
  });
}

export function switchCluster(cluster: ClusterType) {
  localStorage.setItem('preferred-cluster', cluster);
  window.location.reload();
}