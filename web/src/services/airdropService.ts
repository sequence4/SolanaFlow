import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connectionManager } from '@/utils/blockchain/connectionManager';
import { toast } from 'sonner';

class AirdropService {
  private lastAirdropTime: Map<string, number> = new Map();
  
  async requestAirdrop(
    publicKey: PublicKey,
    amount: number = 2 * LAMPORTS_PER_SOL
  ): Promise<boolean> {
    const cluster = connectionManager.getCurrentCluster();
    const connection = connectionManager.getConnection();
    
    // Check rate limit for devnet (only)
    if (cluster === 'devnet') {
      const lastTime = this.lastAirdropTime.get(publicKey.toBase58()) || 0;
      const timeSinceLastAirdrop = Date.now() - lastTime;
      
      if (timeSinceLastAirdrop < 60000) { // 1 minute rate limit
        const waitTime = Math.ceil((60000 - timeSinceLastAirdrop) / 1000);
        toast.error(`Rate limited. Wait ${waitTime} seconds.`);
        return false;
      }
    }
    
    try {
      // Check current balance
      const balance = await connection.getBalance(publicKey);
      
      if (balance >= amount) {
        toast.info('Wallet already has sufficient balance');
        return true;
      }
      
      // Request airdrop
      const signature = await connection.requestAirdrop(publicKey, amount);
      
      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash
      }, 'confirmed');
      
      // Update last airdrop time
      this.lastAirdropTime.set(publicKey.toBase58(), Date.now());
      
      const solAmount = amount / LAMPORTS_PER_SOL;
      toast.success(`Airdropped ${solAmount} SOL!`, {
        description: `Balance updated on ${cluster}`
      });
      
      return true;
    } catch (error) {
      console.error('Airdrop error:', error);
      
      // Special handling for local validator
      if (cluster === 'local') {
        toast.error('Local airdrop failed', {
          description: 'Make sure local validator is running',
          action: {
            label: 'Start Validator',
            onClick: () => window.location.href = '#start-validator'
          }
        });
      } else {
        toast.error('Airdrop failed', {
          description: 'Try again later or use a faucet'
        });
      }
      
      return false;
    }
  }
  
  async autoFundIfNeeded(
    publicKey: PublicKey,
    minBalance: number = 0.5 * LAMPORTS_PER_SOL
  ): Promise<void> {
    const connection = connectionManager.getConnection();
    
    try {
      const balance = await connection.getBalance(publicKey);
      
      if (balance < minBalance) {
        const cluster = connectionManager.getCurrentCluster();
        
        if (cluster === 'local') {
          // Auto-airdrop on local without asking
          await this.requestAirdrop(publicKey, 10 * LAMPORTS_PER_SOL);
        } else {
          // Ask user for devnet
          toast.info('Low balance detected', {
            description: `You have ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL`,
            action: {
              label: 'Request Airdrop',
              onClick: () => this.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL)
            },
            duration: 10000
          });
        }
      }
    } catch (error) {
      console.error('Balance check error:', error);
    }
  }
}

export const airdropService = new AirdropService();