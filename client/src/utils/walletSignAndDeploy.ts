import { Connection, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * React hook for wallet signing and deployment to Solana
 * This is integrated with the backend's new signed transaction relay
 */
export function useWalletSigner() {
  const wallet = useWallet();
  
  /**
   * Signs a transaction with Phantom wallet and sends it to the backend's relay endpoint
   * @returns Confirmed transaction signature
   */
  const signAndRelay = async (projectId: string, encodedTx: string): Promise<string> => {
    if (!wallet.signTransaction || !wallet.publicKey) {
      throw new Error("Wallet not connected or doesn't support signing");
    }
    
    // The transaction should be already built by Anchor CLI on the backend
    // We just need to decode it from base64, sign it, then re-encode
    const buffer = Buffer.from(encodedTx, 'base64');
    const tx = Transaction.from(buffer);
    
    // Sign with Phantom
    const signed = await wallet.signTransaction(tx);
    
    // Serialize back to base64 for transmission
    const signedEncodedTx = signed.serialize({ verifySignatures: false }).toString("base64");
    
    // POST to the backend for relay
    const res = await fetch(`/api/deploy/${projectId}/deploy-signed`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ encodedTx: signedEncodedTx }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Deploy relay failed: ${errorData.error || res.statusText}`);
    }
    
    const { sig } = await res.json();
    return sig as string;
  };
  
  return {
    signAndRelay,
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
  
  // Modify deploy nodes to include the SIGNED flag
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
  
  // Call the regular deploy pipeline API but with the SIGNED flag
  const res = await fetch(`/api/deploy/${projectId}/deploy-pipeline`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ graph: graphCopy }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`Deploy pipeline failed: ${errorData.error || res.statusText}`);
  }
  
  return res;
} 