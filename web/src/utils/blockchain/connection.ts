import { Connection, clusterApiUrl } from '@solana/web3.js';
import { connectionManager } from './connectionManager';

// Keep any existing connection for backward compatibility
export const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('devnet'),
  'confirmed'
);

// ADD THESE NEW EXPORTS
export const getDynamicConnection = () => connectionManager.getConnection();
export const getCurrentCluster = () => connectionManager.getCurrentCluster();
export const switchToCluster = (cluster: string) => connectionManager.switchCluster(cluster as any);
export const isLocalMode = () => connectionManager.getCurrentCluster() === 'local';

// Create a connection that auto-switches based on user preference
export const adaptiveConnection = new Proxy({} as Connection, {
  get(_target, prop) {
    const conn = connectionManager.getConnection();
    return (conn as any)[prop];
  }
});