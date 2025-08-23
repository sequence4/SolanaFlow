import { Connection } from '@solana/web3.js';

export enum ClusterType {
  LOCAL = 'local',
  DEVNET = 'devnet',
  TESTNET = 'testnet',
  MAINNET = 'mainnet-beta',
  CUSTOM = 'custom'
}

export interface ClusterInfo {
  type: ClusterType;
  url: string;
  websocketUrl: string;
  faucetUrl?: string;
  isLocal: boolean;
  name: string;
}

/**
 * Detect cluster type from RPC URL
 */
export function detectClusterFromUrl(url: string): ClusterType {
  const normalizedUrl = url.toLowerCase();
  
  if (normalizedUrl.includes('localhost') || 
      normalizedUrl.includes('127.0.0.1') ||
      normalizedUrl.includes('host.docker.internal')) {
    return ClusterType.LOCAL;
  }
  
  if (normalizedUrl.includes('devnet')) return ClusterType.DEVNET;
  if (normalizedUrl.includes('testnet')) return ClusterType.TESTNET;
  if (normalizedUrl.includes('mainnet')) return ClusterType.MAINNET;
  
  return ClusterType.CUSTOM;
}

/**
 * Get cluster configuration based on type
 */
export function getClusterConfig(type: ClusterType, customUrl?: string): ClusterInfo {
  switch (type) {
    case ClusterType.LOCAL:
      return {
        type: ClusterType.LOCAL,
        url: 'http://localhost:8899',
        websocketUrl: 'ws://localhost:8900',
        faucetUrl: 'http://localhost:9900',
        isLocal: true,
        name: 'Local Validator'
      };
    
    case ClusterType.DEVNET:
      return {
        type: ClusterType.DEVNET,
        url: 'https://api.devnet.solana.com',
        websocketUrl: 'wss://api.devnet.solana.com',
        faucetUrl: 'https://faucet.solana.com',
        isLocal: false,
        name: 'Devnet'
      };
    
    case ClusterType.TESTNET:
      return {
        type: ClusterType.TESTNET,
        url: 'https://api.testnet.solana.com',
        websocketUrl: 'wss://api.testnet.solana.com',
        faucetUrl: 'https://faucet.solana.com',
        isLocal: false,
        name: 'Testnet'
      };
    
    case ClusterType.MAINNET:
      return {
        type: ClusterType.MAINNET,
        url: 'https://api.mainnet-beta.solana.com',
        websocketUrl: 'wss://api.mainnet-beta.solana.com',
        isLocal: false,
        name: 'Mainnet Beta'
      };
    
    case ClusterType.CUSTOM:
    default:
      const detectedType = customUrl ? detectClusterFromUrl(customUrl) : ClusterType.CUSTOM;
      const isLocalCustom = detectedType === ClusterType.LOCAL;
      
      return {
        type: ClusterType.CUSTOM,
        url: customUrl || 'https://api.devnet.solana.com',
        websocketUrl: customUrl ? customUrl.replace('http', 'ws').replace('https', 'wss') : 'wss://api.devnet.solana.com',
        faucetUrl: isLocalCustom ? 'http://localhost:9900' : undefined,
        isLocal: isLocalCustom,
        name: 'Custom RPC'
      };
  }
}

/**
 * Test connection to a cluster
 */
export async function testClusterConnection(url: string): Promise<{
  success: boolean;
  version?: string;
  slot?: number;
  error?: string;
}> {
  try {
    const connection = new Connection(url, 'confirmed');
    
    // Set timeout for connection test
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    const versionPromise = connection.getVersion();
    const slotPromise = connection.getSlot();
    
    const [version, slot] = await Promise.race([
      Promise.all([versionPromise, slotPromise]),
      timeoutPromise
    ]) as [any, number];
    
    return {
      success: true,
      version: version['solana-core'] || version,
      slot
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get the appropriate cluster for a project
 */
export async function getProjectCluster(
  projectId: string,
  preferLocal: boolean = false
): Promise<ClusterInfo> {
  // First, check if local validator is available
  if (preferLocal) {
    const localTest = await testClusterConnection('http://localhost:8899');
    if (localTest.success) {
      console.log(`[CLUSTER] Using local validator for project ${projectId}`);
      return getClusterConfig(ClusterType.LOCAL);
    }
  }
  
  // Fall back to environment variable or devnet
  const envUrl = process.env.SOLANA_RPC_URL;
  if (envUrl) {
    const type = detectClusterFromUrl(envUrl);
    return getClusterConfig(type, envUrl);
  }
  
  // Default to devnet
  return getClusterConfig(ClusterType.DEVNET);
}