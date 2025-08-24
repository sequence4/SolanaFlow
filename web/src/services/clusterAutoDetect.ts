import { connectionManager } from '@/utils/blockchain/connectionManager';
import { toast } from 'sonner';

class ClusterAutoDetect {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastLocalStatus: boolean = false;
  
  startMonitoring() {
    // Check every 10 seconds
    this.checkInterval = setInterval(() => this.checkLocalValidator(), 10000);
    
    // Initial check
    this.checkLocalValidator();
  }
  
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  private async checkLocalValidator() {
    const isLocal = connectionManager.getCurrentCluster() === 'local';
    const localRunning = await connectionManager.isLocalValidatorRunning();
    
    // If we're on devnet but local validator just started
    if (!isLocal && localRunning && !this.lastLocalStatus) {
      toast.info('Local validator detected!', {
        description: 'Switch to local mode for faster testing?',
        action: {
          label: 'Switch',
          onClick: () => connectionManager.switchCluster('local')
        },
        duration: 10000
      });
    }
    
    // If we're on local but validator stopped
    if (isLocal && !localRunning && this.lastLocalStatus) {
      toast.warning('Local validator stopped', {
        description: 'Switching back to devnet...',
        duration: 5000
      });
      
      setTimeout(() => {
        connectionManager.switchCluster('devnet');
      }, 2000);
    }
    
    this.lastLocalStatus = localRunning;
  }
}

export const clusterAutoDetect = new ClusterAutoDetect();