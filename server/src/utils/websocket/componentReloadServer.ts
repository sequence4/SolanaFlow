/**
 * WebSocket Server for Component Hot Reload
 * Manages real-time component updates and file watching
 */

import { Server as HTTPServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { FSWatcher, watch } from 'chokidar';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { EventEmitter } from 'events';

interface ComponentUpdate {
  type: 'component-update' | 'config-update' | 'full-reload';
  componentName?: string;
  timestamp: number;
  checksum?: string;
  changes?: string[];
}

interface Client {
  id: string;
  ws: WebSocket;
  projectId: string;
  lastSeen: number;
}

export class ComponentReloadServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private checksums: Map<string, string> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  constructor(private rootPath: string = process.env.ROOT_FOLDER || '/projects') {
    super();
  }
  
  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: false
    });
    
    this.wss.on('connection', (ws: WebSocket, request) => {
      const projectId = this.extractProjectId(request.url);
      const clientId = crypto.randomUUID();
      
      const client: Client = {
        id: clientId,
        ws,
        projectId,
        lastSeen: Date.now()
      };
      
      this.clients.set(clientId, client);
      console.log(`[ComponentReloadServer] Client connected: ${clientId} for project: ${projectId}`);
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        projectId
      }));
      
      // Start watching project files if not already watching
      if (!this.watchers.has(projectId)) {
        this.startWatching(projectId);
      }
      
      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error('[ComponentReloadServer] Invalid message from client:', error);
        }
      });
      
      // Handle disconnect
      ws.on('close', () => {
        console.log(`[ComponentReloadServer] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        
        // Stop watching if no more clients for this project
        const hasOtherClients = Array.from(this.clients.values())
          .some(c => c.projectId === projectId);
        
        if (!hasOtherClients && this.watchers.has(projectId)) {
          this.stopWatching(projectId);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`[ComponentReloadServer] WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });
    
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
    
    console.log('[ComponentReloadServer] WebSocket server initialized');
  }
  
  /**
   * Start watching project files for changes
   */
  private startWatching(projectId: string): void {
    const projectPath = path.join(this.rootPath, projectId);
    const watchPaths = [
      path.join(projectPath, 'web/src/components/generated'),
      path.join(projectPath, 'web/public/config'),
      path.join(projectPath, 'target/idl') // Watch for IDL changes
    ];
    
    // Create directories if they don't exist
    watchPaths.forEach(p => {
      if (!fs.existsSync(p)) {
        try {
          fs.mkdirSync(p, { recursive: true });
        } catch (error) {
          console.warn(`[ComponentReloadServer] Could not create directory ${p}:`, error);
        }
      }
    });
    
    // Filter out non-existent paths
    const existingPaths = watchPaths.filter(p => fs.existsSync(p));
    
    if (existingPaths.length === 0) {
      console.warn(`[ComponentReloadServer] No valid paths to watch for project ${projectId}`);
      return;
    }
    
    const watcher = watch(existingPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      },
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/.git/**',
        '**/*.log'
      ]
    });
    
    watcher.on('change', (filePath) => {
      this.handleFileChange(projectId, filePath, 'change');
    });
    
    watcher.on('add', (filePath) => {
      this.handleFileChange(projectId, filePath, 'add');
    });
    
    watcher.on('unlink', (filePath) => {
      this.handleFileChange(projectId, filePath, 'remove');
    });
    
    this.watchers.set(projectId, watcher);
    console.log(`[ComponentReloadServer] Started watching project: ${projectId}`);
  }
  
  /**
   * Stop watching project files
   */
  private stopWatching(projectId: string): void {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      console.log(`[ComponentReloadServer] Stopped watching project: ${projectId}`);
    }
  }
  
  /**
   * Handle file changes
   */
  private handleFileChange(projectId: string, filePath: string, changeType: string): void {
    console.log(`[ComponentReloadServer] File ${changeType}: ${filePath}`);
    
    // Calculate file checksum
    let checksum = '';
    if (changeType !== 'remove' && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath);
        checksum = crypto.createHash('md5').update(content).digest('hex');
        
        // Check if content actually changed
        const previousChecksum = this.checksums.get(filePath);
        if (previousChecksum === checksum) {
          console.log('[ComponentReloadServer] File content unchanged, skipping reload');
          return;
        }
        
        this.checksums.set(filePath, checksum);
      } catch (error) {
        console.error(`[ComponentReloadServer] Error reading file ${filePath}:`, error);
      }
    } else {
      this.checksums.delete(filePath);
    }
    
    // Determine update type
    let updateType: ComponentUpdate['type'] = 'component-update';
    let componentName: string | undefined;
    
    if (filePath.includes('component-manifest.json')) {
      updateType = 'config-update';
    } else if (filePath.includes('/generated/')) {
      // Extract component name from path
      const match = filePath.match(/generated[\/\\]([^\/\\]+)\.(tsx?|jsx?)$/);
      if (match) {
        componentName = match[1];
      }
    } else if (filePath.includes('.idl')) {
      updateType = 'full-reload';
    }
    
    // Create update message
    const update: ComponentUpdate = {
      type: updateType,
      componentName,
      timestamp: Date.now(),
      checksum,
      changes: [changeType]
    };
    
    // Notify all clients for this project
    this.broadcastToProject(projectId, update);
    
    // Emit event for other systems
    this.emit('component-update', {
      projectId,
      filePath,
      changeType,
      update
    });
  }
  
  /**
   * Broadcast update to all clients of a project
   */
  private broadcastToProject(projectId: string, update: ComponentUpdate): void {
    let clientCount = 0;
    
    this.clients.forEach(client => {
      if (client.projectId === projectId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(update));
          clientCount++;
        } catch (error) {
          console.error(`[ComponentReloadServer] Error sending to client ${client.id}:`, error);
        }
      }
    });
    
    console.log(`[ComponentReloadServer] Broadcasted update to ${clientCount} clients for project ${projectId}`);
  }
  
  /**
   * Handle messages from clients
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    switch (message.type) {
      case 'ping':
        client.lastSeen = Date.now();
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;
        
      case 'request-reload':
        this.handleFileChange(
          client.projectId,
          message.filePath || 'manual-reload',
          'manual'
        );
        break;
        
      case 'get-status':
        const status = {
          type: 'status',
          watching: this.watchers.has(client.projectId),
          clients: Array.from(this.clients.values())
            .filter(c => c.projectId === client.projectId)
            .length
        };
        client.ws.send(JSON.stringify(status));
        break;
    }
  }
  
  /**
   * Extract project ID from request URL
   */
  private extractProjectId(url?: string): string {
    if (!url) return 'default';
    
    // Try to extract from URL patterns like /ws?projectId=xxx or /ws/xxx
    const queryMatch = url.match(/projectId=([^&]+)/);
    if (queryMatch) return queryMatch[1];
    
    const pathMatch = url.match(/\/ws\/([^\/\?]+)/);
    if (pathMatch) return pathMatch[1];
    
    // Try to extract from referer or other headers
    return 'default';
  }
  
  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds
      
      this.clients.forEach((client, clientId) => {
        if (now - client.lastSeen > timeout) {
          console.log(`[ComponentReloadServer] Removing stale client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify({ type: 'heartbeat' }));
          } catch (error) {
            console.error(`[ComponentReloadServer] Error sending heartbeat to ${clientId}:`, error);
          }
        }
      });
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Shutdown the server
   */
  shutdown(): void {
    console.log('[ComponentReloadServer] Shutting down...');
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close all watchers
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    
    // Close all client connections
    this.clients.forEach(client => {
      try {
        client.ws.close();
      } catch (error) {
        // Ignore close errors
      }
    });
    this.clients.clear();
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    this.emit('shutdown');
  }
  
  /**
   * Force reload for a specific project
   */
  forceReload(projectId: string, reason?: string): void {
    const update: ComponentUpdate = {
      type: 'full-reload',
      timestamp: Date.now(),
      changes: [reason || 'forced']
    };
    
    this.broadcastToProject(projectId, update);
  }
  
  /**
   * Get status information
   */
  getStatus(): any {
    return {
      clients: this.clients.size,
      watchers: this.watchers.size,
      projects: Array.from(new Set(
        Array.from(this.clients.values()).map(c => c.projectId)
      ))
    };
  }
}

// Singleton instance
export const componentReloadServer = new ComponentReloadServer();