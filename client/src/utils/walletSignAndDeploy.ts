import { Buffer } from "buffer";
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
    
    // The transaction should be already built by the backend with a placeholder signer
    // We need to decode it from base64, replace the placeholder signer with our wallet, then sign
    const buffer = Buffer.from(encodedTx, 'base64');
    const tx = Transaction.from(buffer);
    
    console.log(`[signAndRelay] Transaction before updating:`, {
      feePayer: tx.feePayer?.toBase58(),
      signers: tx.signatures.map(s => s.publicKey.toBase58())
    });
    
    // Replace the placeholder fee payer with the wallet's public key
    tx.feePayer = wallet.publicKey;
    
    // Clear existing signatures (they were for the placeholder key)
    tx.signatures = [];
    
    console.log(`[signAndRelay] Transaction after updating:`, {
      feePayer: tx.feePayer.toBase58(),
      signerCount: tx.signatures.length
    });
    
    // Sign with Phantom
    try {
      const signed = await wallet.signTransaction(tx);
    
    // Serialize back to base64 for transmission
    const signedEncodedTx = signed.serialize({ verifySignatures: false }).toString("base64");
    
    // Build headers with proper authorization
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    // POST to the backend for relay
    const res = await fetch(`/api/deploy/${projectId}/deploy-signed`, {
      method: "POST",
      headers,
      body: JSON.stringify({ encodedTx: signedEncodedTx }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Deploy relay failed: ${errorData.error || res.statusText}`);
    }
    
    const { sig } = await res.json();
    return sig as string;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error("Failed to sign transaction: " + errorMessage);
    }
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