/**
 * Comprehensive debug logging utility for tracking pipeline events
 * and identifying rendering performance issues.
 */

import React from 'react';

interface DebugEvent {
  timestamp: number;
  category: string;
  event: string;
  data?: any;
  stack?: string;
}

export class PipelineDebugger {
  private static instance: PipelineDebugger;
  private eventLog: DebugEvent[] = [];
  private stageTransitions: Map<string, number> = new Map();
  private renderCounts: Map<string, number> = new Map();
  private fileGenerationLog: Map<string, number> = new Map();
  private maxLogSize = 200;
  
  static getInstance(): PipelineDebugger {
    if (!this.instance) {
      this.instance = new PipelineDebugger();
    }
    return this.instance;
  }
  
  logEvent(category: string, event: string, data?: any) {
    const entry: DebugEvent = {
      timestamp: Date.now(),
      category,
      event,
      data,
      stack: new Error().stack?.split('\n').slice(2, 4).join(' > ')
    };
    
    this.eventLog.push(entry);
    
    // Color-coded console logging
    const colors = {
      RENDER: '#00ff00',
      PROGRESS: '#00aaff', 
      EVENT: '#ffaa00',
      ERROR: '#ff0000',
      SCROLL: '#ff00ff'
    };
    
    const color = colors[category as keyof typeof colors] || '#ffffff';
    
    console.log(
      `%c[${category}] ${event}`,
      `color: ${color}; font-weight: bold;`,
      data ? JSON.stringify(data, null, 2) : '',
      data?.stack ? `\n  at ${entry.stack}` : ''
    );
    
    // Keep log size manageable
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }
  }
  
  logRender(componentName: string, props?: any) {
    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);
    
    // Warn about excessive re-renders
    if (count > 10 && count % 5 === 0) {
      console.warn(`[RENDER] ${componentName} has rendered ${count} times - possible performance issue!`);
    }
    
    this.logEvent('RENDER', componentName, {
      renderCount: count,
      props: props ? Object.keys(props) : undefined
    });
  }
  
  logStageTransition(from: string, to: string) {
    const key = `${from}->${to}`;
    const count = (this.stageTransitions.get(key) || 0) + 1;
    this.stageTransitions.set(key, count);
    
    if (count > 1) {
      console.warn(`[STAGE-TRANSITION] Duplicate transition detected: ${key} (${count} times)`);
    }
    
    this.logEvent('PROGRESS', `Stage: ${from} -> ${to}`, { 
      transitionCount: count 
    });
  }
  
  logScrollEvent(eventType: 'user' | 'auto' | 'force', details?: any) {
    this.logEvent('SCROLL', eventType, details);
  }
  
  logFileGeneration(fileName: string, index: number, total: number) {
    this.fileGenerationLog.set(fileName, Date.now());
    
    this.logEvent('FILE-GEN', `${index}/${total}: ${fileName}`, {
      fileName,
      index,
      total,
      progress: Math.round((index / total) * 100)
    });
    
    // Warn if file generation appears stalled
    if (index > 4 && index === total) {
      const firstFileTime = Array.from(this.fileGenerationLog.values())[0] || 0;
      const totalTime = Date.now() - firstFileTime;
      if (totalTime > 10000) {
        console.warn(`[FILE-GEN] File generation took ${totalTime}ms for ${total} files`);
      }
    }
  }
  
  getPerformanceReport(): string {
    const now = Date.now();
    const recentEvents = this.eventLog.filter(e => now - e.timestamp < 60000); // Last minute
    
    const duplicateEvents = this.eventLog.reduce((acc, event) => {
      const key = `${event.category}-${event.event}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const excessiveRenders = Array.from(this.renderCounts.entries())
      .filter(([_, count]) => count > 15)
      .sort(([_, a], [__, b]) => b - a);
    
    const report = {
      totalEvents: this.eventLog.length,
      recentEvents: recentEvents.length,
      duplicates: Object.entries(duplicateEvents).filter(([_, count]) => count > 3),
      excessiveRenders,
      stageTransitions: Array.from(this.stageTransitions.entries()),
      topEventCategories: this.getTopEventCategories(),
      recentErrorEvents: this.eventLog.filter(e => e.category === 'ERROR').slice(-5),
      fileGenerationStats: {
        totalFiles: this.fileGenerationLog.size,
        files: Array.from(this.fileGenerationLog.entries()).slice(-10)
      }
    };
    
    return JSON.stringify(report, null, 2);
  }
  
  private getTopEventCategories(): Array<[string, number]> {
    const categories = this.eventLog.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categories)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10);
  }
  
  clear() {
    this.eventLog = [];
    this.stageTransitions.clear();
    this.renderCounts.clear();
    console.log('[DEBUG] Cleared all logs');
  }
  
  // Export logs for analysis
  exportLogs(): string {
    return JSON.stringify({
      events: this.eventLog,
      transitions: Array.from(this.stageTransitions.entries()),
      renders: Array.from(this.renderCounts.entries()),
      exportedAt: Date.now()
    }, null, 2);
  }
}

// Global debug instance
export const debugLogger = PipelineDebugger.getInstance();

// React hook for component render tracking
export function useDebugRender(componentName: string, props?: any) {
  React.useEffect(() => {
    debugLogger.logRender(componentName, props);
  });
}