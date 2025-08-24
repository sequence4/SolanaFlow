"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  HardDrive, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Zap,
  DollarSign
} from 'lucide-react';
import { connectionManager } from '@/utils/blockchain/connectionManager';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';

interface ClusterToggleProps {
  projectId: string;
  onClusterChange?: (cluster: string) => void;
  className?: string;
}

export function ClusterToggle({ 
  projectId, 
  onClusterChange,
  className = ""
}: ClusterToggleProps) {
  const { publicKey } = useWallet();
  const [currentCluster, setCurrentCluster] = useState<'local' | 'devnet'>('devnet');
  const [isLoading, setIsLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<{
    running: boolean;
    responsive: boolean;
    programDeployed: boolean;
  }>({ running: false, responsive: false, programDeployed: false });
  
  // Check local validator status
  useEffect(() => {
    checkLocalStatus();
    const interval = setInterval(checkLocalStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [projectId]);
  
  // Subscribe to cluster changes
  useEffect(() => {
    const unsubscribe = connectionManager.onClusterChange((cluster) => {
      setCurrentCluster(cluster === 'local' ? 'local' : 'devnet');
      onClusterChange?.(cluster);
    });
    
    // Set initial value
    setCurrentCluster(connectionManager.getCurrentCluster() === 'local' ? 'local' : 'devnet');
    
    return unsubscribe;
  }, [onClusterChange]);
  
  async function checkLocalStatus() {
    try {
      // Check validator health
      const healthRes = await fetch(`/api/projects/${projectId}/local-validator/health`);
      const health = await healthRes.json();
      
      // Check if program is deployed locally
      const clusterInfoRes = await fetch(`/api/projects/${projectId}/cluster-info?preferLocal=true`);
      const clusterInfo = await clusterInfoRes.json();
      
      setLocalStatus({
        running: health.running || false,
        responsive: health.responsive || false,
        programDeployed: !!clusterInfo.programIds?.local
      });
    } catch (error) {
      setLocalStatus({ running: false, responsive: false, programDeployed: false });
    }
  }
  
  async function handleToggle(checked: boolean) {
    const targetCluster = checked ? 'local' : 'devnet';
    setIsLoading(true);
    
    try {
      if (targetCluster === 'local') {
        // Switching to local
        if (!localStatus.running) {
          toast.info('Starting local validator...');
          
          // Start validator
          const startRes = await fetch(`/api/projects/${projectId}/local-validator/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletPubkey: publicKey?.toBase58()
            })
          });
          
          const startData = await startRes.json();
          if (!startData.status || startData.status === 'error') {
            throw new Error('Failed to start validator');
          }
          
          // Wait for validator to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (!localStatus.programDeployed) {
          toast.info('Deploying program to local validator...');
          
          // Quick deploy to local
          const deployRes = await fetch(`/api/projects/${projectId}/local-validator/quick-deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletPubkey: publicKey?.toBase58()
            })
          });
          
          const deployData = await deployRes.json();
          if (!deployData.programId) {
            throw new Error('Failed to deploy program');
          }
          
          toast.success(`Program deployed: ${deployData.programId.slice(0, 8)}...`);
        }
      }
      
      // Switch cluster
      const switched = await connectionManager.switchCluster(targetCluster);
      
      if (!switched) {
        throw new Error(`Failed to connect to ${targetCluster}`);
      }
      
      // Update backend cluster config
      await fetch(`/api/projects/${projectId}/switch-cluster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster: targetCluster })
      });
      
      setCurrentCluster(targetCluster);
      toast.success(`Switched to ${targetCluster === 'local' ? 'Local Validator' : 'Devnet'}`);
      
      // Reload the page to apply new connection
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      console.error('Cluster switch error:', error);
      toast.error(`Failed to switch to ${targetCluster}`, {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const isLocal = currentCluster === 'local';
  
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border bg-card ${className}`}>
      <div className="flex items-center gap-2">
        {isLocal ? (
          <HardDrive className="h-5 w-5 text-green-500" />
        ) : (
          <Globe className="h-5 w-5 text-blue-500" />
        )}
        <Label htmlFor="cluster-toggle" className="text-sm font-medium">
          Network
        </Label>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Switch
                id="cluster-toggle"
                checked={isLocal}
                onCheckedChange={handleToggle}
                disabled={isLoading}
              />
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2 max-w-xs">
              <p className="font-semibold">
                {isLocal ? 'Local Validator' : 'Solana Devnet'}
              </p>
              <div className="space-y-1 text-xs">
                {isLocal ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      <span>Instant transactions (no waiting)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Free SOL (unlimited airdrops)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Perfect for testing</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>Public testnet</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>Requires devnet SOL</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Persistent state</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <div className="flex items-center gap-2 ml-auto">
        <Badge variant={isLocal ? "default" : "secondary"}>
          {isLocal ? 'Local' : 'Devnet'}
        </Badge>
        
        {isLocal && (
          <div className="flex items-center gap-1">
            {localStatus.running ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {localStatus.running ? 'Running' : 'Stopped'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}