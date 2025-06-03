import { Connection, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * React hook for wallet transaction signing 
 * This is a simplified version that just provides basic wallet utilities
 */
export function useWalletSigner() {
  const wallet = useWallet();
  
  /**
   * A simple helper to send a transaction using the connected wallet
   */
  const sendTransaction = async (transaction: Transaction, connection: Connection): Promise<string> => {
    if (!wallet.signTransaction || !wallet.publicKey) {
      throw new Error("Wallet not connected or doesn't support signing");
    }
    
    // Set the fee payer to the wallet's public key
    transaction.feePayer = wallet.publicKey;
    
    // Get recent blockhash if not already set
    if (!transaction.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
    }
    
    try {
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Return the transaction signature
      return signature;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error("Failed to sign or send transaction: " + errorMessage);
    }
  };
  
  return {
    sendTransaction,
    isConnected: !!wallet.connected,
    publicKey: wallet.publicKey
  };
}

/**
 * Triggers the deployment pipeline with the SIGNED flag
 * This should be called immediately after successfully relaying a signed transaction
 */
export async function triggerSignedDeploy(projectId: string, graph: any): Promise<Response> {
  // Make a deep copy of the graph
  const graphCopy = JSON.parse(JSON.stringify(graph));
  
  // Set the SIGNED flag in multiple possible locations to ensure it reaches the backend
  
  // 1. In the deployConfig object (main location)
  graphCopy.deployConfig = { 
    ...graphCopy.deployConfig || {}, 
    ephemeralPubkey: 'SIGNED' 
  };
  
  // 2. In each deploy node as before
  if (graphCopy.nodes) {
    graphCopy.nodes = graphCopy.nodes.map((node: any) => {
      if (node.type === 'deploy') {
        return {
          ...node,
          ephemeralPubkey: 'SIGNED'
        };
      }
      return node;
    });
  }
  
  console.log('[DEPLOY] Sending graph with SIGNED flag:', 
    JSON.stringify({
      deployConfig: graphCopy.deployConfig,
      nodeFlags: graphCopy.nodes?.filter((n: any) => n.type === 'deploy').map((n: any) => n.ephemeralPubkey)
    })
  );
  
  // Build headers with proper authorization
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  // Call the regular deploy pipeline API with the SIGNED flag
  const res = await fetch(`/api/deploy/${projectId}/deploy-pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify({ graph: graphCopy }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Deploy pipeline failed: ${errorData.error || res.statusText}`);
  }
  
  return res;
} 