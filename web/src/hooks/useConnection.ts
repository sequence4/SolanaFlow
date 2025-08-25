import { useEffect, useState } from 'react';
import { connectionManager } from '@/utils/blockchain/connectionManager';

export function useDynamicConnection(projectId?: string) {
  const [cluster, setCluster] = useState(connectionManager.getCurrentCluster());
  const [connection, setConnection] = useState(connectionManager.getConnection());
  const [rpcUrl, setRpcUrl] = useState<string>('https://api.devnet.solana.com');
  
  useEffect(() => {
    // Subscribe to cluster changes
    const unsubscribe = connectionManager.onClusterChange((newCluster) => {
      setCluster(newCluster);
      setConnection(connectionManager.getConnection());
    });
    
    // Update RPC URL based on cluster and project
    const updateRpcUrl = async () => {
      if (cluster === 'local' && projectId) {
        const ports = await connectionManager.getProjectPorts(projectId);
        setRpcUrl(`http://localhost:${ports.rpc}`);
      } else if (cluster === 'local') {
        setRpcUrl('http://localhost:28899');
      } else {
        setRpcUrl('https://api.devnet.solana.com');
      }
    };
    
    updateRpcUrl();
    
    return unsubscribe;
  }, [cluster, projectId]);
  
  return {
    connection,
    cluster,
    isLocal: cluster === 'local',
    rpcUrl
  };
}