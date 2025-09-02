/**
 * Hot Reload Manager
 * Manages WebSocket connections and component hot reload functionality
 */

import { EventEmitter } from 'events';

interface ReloadEvent {
  type: 'component-update' | 'config-update' | 'file-change' | 'force-reload';
  projectId: string;
  componentName?: string;
  filePath?: string;
  timestamp: number;
  update?: {
    type: string;
    content?: any;
  };
}

interface HotReloadConfig {
  enabled: boolean;
  wsUrl: string;
  projectId: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

class HotReloadManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: HotReloadConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private messageQueue: any[] = [];
  
  constructor(config: Partial<HotReloadConfig> = {}) {
    super();
    
    this.config = {
      enabled: process.env.NODE_ENV === 'development' && 
               process.env.NEXT_PUBLIC_HOT_RELOAD === 'true',
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
      projectId: process.env.NEXT_PUBLIC_APP_ID || 'local',
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      ...config
    };
    
    if (this.config.enabled) {
      this.connect();
    }
  }
  
  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    this.isConnecting = true;
    
    try {
      console.log('[HotReloadManager] Connecting to WebSocket:', this.config.wsUrl);
      
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('[HotReloadManager] WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Register project
        this.send({
          type: 'register',
          projectId: this.config.projectId
        });
        
        // Process queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.send(message);
        }
        
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[HotReloadManager] Error parsing message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[HotReloadManager] WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };
      
      this.ws.onclose = () => {
        console.log('[HotReloadManager] WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        
        this.emit('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[HotReloadManager] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any): void {
    console.log('[HotReloadManager] Received message:', data);
    
    switch (data.type) {
      case 'component-update':
        this.handleComponentUpdate(data as ReloadEvent);
        break;
        
      case 'config-update':
        this.handleConfigUpdate(data as ReloadEvent);
        break;
        
      case 'file-change':
        this.handleFileChange(data as ReloadEvent);
        break;
        
      case 'force-reload':
        this.handleForceReload(data as ReloadEvent);
        break;
        
      case 'pong':
        // Keep-alive response
        break;
        
      default:
        console.warn('[HotReloadManager] Unknown message type:', data.type);
    }
  }
  
  /**
   * Handle component update event
   */
  private handleComponentUpdate(event: ReloadEvent): void {
    console.log('[HotReloadManager] Component update:', event.componentName);
    
    // Clear component cache
    if (event.componentName) {
      this.clearComponentCache(event.componentName);
    }
    
    // Emit event for React components to handle
    this.emit('component-update', event);
    
    // Trigger React Fast Refresh if available
    if (typeof window !== 'undefined' && (window as any).$RefreshReg$) {
      (window as any).$RefreshReg$();
      (window as any).$RefreshSig$();
    }
  }
  
  /**
   * Handle configuration update event
   */
  private handleConfigUpdate(event: ReloadEvent): void {
    console.log('[HotReloadManager] Config update:', event.filePath);
    
    // Clear all component caches
    this.clearAllComponentCaches();
    
    // Emit event for components to reload
    this.emit('config-update', event);
  }
  
  /**
   * Handle file change event
   */
  private handleFileChange(event: ReloadEvent): void {
    console.log('[HotReloadManager] File change:', event.filePath);
    
    // Determine affected components
    const affectedComponent = this.getAffectedComponent(event.filePath);
    if (affectedComponent) {
      this.clearComponentCache(affectedComponent);
    }
    
    this.emit('file-change', event);
  }
  
  /**
   * Handle force reload event
   */
  private handleForceReload(event: ReloadEvent): void {
    console.log('[HotReloadManager] Force reload requested');
    
    // Clear all caches
    this.clearAllComponentCaches();
    
    // Emit event
    this.emit('force-reload', event);
    
    // Optional: Reload the page after a short delay
    if (event.update?.type === 'hard-reload') {
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }
  
  /**
   * Clear component cache
   */
  private clearComponentCache(componentName: string): void {
    const cacheKey = `component_${this.config.projectId}_${componentName}`;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(cacheKey);
    }
    
    // Also clear from session storage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(cacheKey);
    }
  }
  
  /**
   * Clear all component caches
   */
  private clearAllComponentCaches(): void {
    if (typeof window === 'undefined') return;
    
    const prefix = `component_${this.config.projectId}_`;
    
    // Clear localStorage
    if (window.localStorage) {
      const keys = Object.keys(window.localStorage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          window.localStorage.removeItem(key);
        }
      });
    }
    
    // Clear sessionStorage
    if (window.sessionStorage) {
      const keys = Object.keys(window.sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          window.sessionStorage.removeItem(key);
        }
      });
    }
  }
  
  /**
   * Get affected component from file path
   */
  private getAffectedComponent(filePath?: string): string | null {
    if (!filePath) return null;
    
    // Extract component name from path
    const match = filePath.match(/components\/generated\/([^/]+)\//);
    if (match) {
      return match[1];
    }
    
    // Check if it's a config file
    if (filePath.endsWith('config.json')) {
      const configMatch = filePath.match(/([^/]+)\/config\.json$/);
      if (configMatch) {
        return configMatch[1];
      }
    }
    
    return null;
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[HotReloadManager] Max reconnect attempts reached');
      this.emit('max-reconnect-attempts');
      return;
    }
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    console.log(`[HotReloadManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  /**
   * Send message to WebSocket server
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
    }
  }
  
  /**
   * Request component reload
   */
  requestReload(componentName: string, reason?: string): void {
    this.send({
      type: 'reload-request',
      projectId: this.config.projectId,
      componentName,
      reason: reason || 'Manual reload requested',
      timestamp: Date.now()
    });
  }
  
  /**
   * Enable hot reload
   */
  enable(): void {
    if (!this.config.enabled) {
      this.config.enabled = true;
      this.connect();
    }
  }
  
  /**
   * Disable hot reload
   */
  disable(): void {
    this.config.enabled = false;
    this.disconnect();
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.messageQueue = [];
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    enabled: boolean;
    projectId: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      enabled: this.config.enabled,
      projectId: this.config.projectId,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
let instance: HotReloadManager | null = null;

/**
 * Get or create HotReloadManager instance
 */
export function getHotReloadManager(config?: Partial<HotReloadConfig>): HotReloadManager {
  if (!instance) {
    instance = new HotReloadManager(config);
  }
  return instance;
}

/**
 * React hook for hot reload
 */
export function useHotReload(componentName: string, onReload?: () => void): {
  isConnected: boolean;
  requestReload: (reason?: string) => void;
} {
  const [isConnected, setIsConnected] = React.useState(false);
  
  React.useEffect(() => {
    const manager = getHotReloadManager();
    
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    const handleUpdate = (event: ReloadEvent) => {
      if (event.componentName === componentName || !event.componentName) {
        console.log(`[useHotReload] Reloading ${componentName}`);
        onReload?.();
      }
    };
    
    manager.on('connected', handleConnect);
    manager.on('disconnected', handleDisconnect);
    manager.on('component-update', handleUpdate);
    manager.on('force-reload', handleUpdate);
    
    // Check initial connection status
    setIsConnected(manager.isConnected());
    
    return () => {
      manager.off('connected', handleConnect);
      manager.off('disconnected', handleDisconnect);
      manager.off('component-update', handleUpdate);
      manager.off('force-reload', handleUpdate);
    };
  }, [componentName, onReload]);
  
  const requestReload = React.useCallback((reason?: string) => {
    const manager = getHotReloadManager();
    manager.requestReload(componentName, reason);
  }, [componentName]);
  
  return {
    isConnected,
    requestReload
  };
}

// Import React for the hook
import * as React from 'react';

export default HotReloadManager;
export type { ReloadEvent, HotReloadConfig };