"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';

interface LocalDeployerProps {
  projectId: string;
  onSuccess?: (programId: string) => void;
}

export function LocalDeployer({ projectId, onSuccess }: LocalDeployerProps) {
  const { publicKey } = useWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  
  async function handleDeploy() {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }
    
    setIsDeploying(true);
    
    try {
      // Quick deploy to local validator
      const response = await fetch(`/api/projects/${projectId}/local-validator/quick-deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletPubkey: publicKey.toBase58(),
          resetValidator: false
        })
      });
      
      const data = await response.json();
      
      if (data.programId) {
        toast.success('Program deployed to local validator!', {
          description: `Program ID: ${data.programId.slice(0, 16)}...`,
          action: {
            label: 'Copy ID',
            onClick: () => {
              navigator.clipboard.writeText(data.programId);
              toast.success('Program ID copied!');
            }
          }
        });
        
        onSuccess?.(data.programId);
      } else {
        throw new Error(data.message || 'Deployment failed');
      }
    } catch (error) {
      console.error('Local deployment error:', error);
      toast.error('Deployment failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsDeploying(false);
    }
  }
  
  return (
    <Button
      onClick={handleDeploy}
      disabled={isDeploying || !publicKey}
      variant="outline"
      className="gap-2"
    >
      {isDeploying ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Deploying Locally...
        </>
      ) : (
        <>
          <Rocket className="h-4 w-4" />
          Deploy to Local
        </>
      )}
    </Button>
  );
}