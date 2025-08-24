import { useMemo, useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { connectionManager } from '@/utils/blockchain/connectionManager';

export function useDynamicConnection() {
  const [cluster, setCluster] = useState(connectionManager.getCurrentCluster());
  const [connection, setConnection] = useState(connectionManager.getConnection());
  
  useEffect(() => {
    // Subscribe to cluster changes
    const unsubscribe = connectionManager.onClusterChange((newCluster) => {
      setCluster(newCluster);
      setConnection(connectionManager.getConnection());
    });
    
    return unsubscribe;
  }, []);
  
  return {
    connection,
    cluster,
    isLocal: cluster === 'local',
    rpcUrl: cluster === 'local' ? 'http://localhost:8899' : 'https://api.devnet.solana.com'
  };
}