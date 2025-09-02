import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Coins, Loader2 } from 'lucide-react';
import { airdropService } from '@/services/airdropService';
import { connectionManager } from '@/utils/blockchain/connectionManager';
import { toast } from 'sonner';

interface AirdropButtonProps {
  amount?: number;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const AirdropButton: React.FC<AirdropButtonProps> = ({
  amount = 2,
  className = '',
  variant = 'outline',
  size = 'sm'
}) => {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [cluster] = useState(connectionManager.getCurrentCluster());
  
  const handleAirdrop = async () => {
    if (!publicKey) {
      toast.error('Connect wallet first');
      return;
    }
    
    if (cluster === 'mainnet-beta') {
      toast.error('Airdrop not available on mainnet');
      return;
    }
    
    setLoading(true);
    try {
      const success = await airdropService.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      if (success) {
        // Optionally trigger balance refresh in parent
        window.dispatchEvent(new CustomEvent('balanceUpdate'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Don't show on mainnet
  if (cluster === 'mainnet-beta') {
    return null;
  }
  
  return (
    <Button
      onClick={handleAirdrop}
      disabled={!connected || loading}
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Requesting...
        </>
      ) : (
        <>
          <Coins className="h-4 w-4" />
          Airdrop {amount} SOL
        </>
      )}
    </Button>
  );
};