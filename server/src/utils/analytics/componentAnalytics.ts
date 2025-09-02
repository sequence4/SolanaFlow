/**
 * Component Analytics
 * Tracks metrics, performance, and usage of UI components
 */

import { EventEmitter } from 'events';
import pool from '../../config/database';

export class ComponentAnalytics extends EventEmitter {
  private metricsBuffer: MetricEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  
  constructor() {
    super();
    
    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
    
    console.log('[Analytics] Component analytics initialized');
  }
  
  /**
   * Track component load time
   */
  trackComponentLoad(data: {
    projectId: string;
    componentName: string;
    version: string;
    loadTime: number;
    cached: boolean;
  }): void {
    this.metricsBuffer.push({
      type: 'component-load',
      projectId: data.projectId,
      timestamp: new Date(),
      data
    });
  }
  
  /**
   * Track hot reload event
   */
  trackHotReload(data: {
    projectId: string;
    triggerType: 'manual' | 'automatic' | 'file-change';
    reloadTime: number;
    success: boolean;
  }): void {
    this.metricsBuffer.push({
      type: 'hot-reload',
      projectId: data.projectId,
      timestamp: new Date(),
      data
    });
  }
  
  /**
   * Track component error
   */
  trackError(data: {
    projectId: string;
    componentName: string;
    error: string;
    stack?: string;
    recovered: boolean;
  }): void {
    this.metricsBuffer.push({
      type: 'component-error',
      projectId: data.projectId,
      timestamp: new Date(),
      data
    });
  }
  
  /**
   * Track component interaction
   */
  trackInteraction(data: {
    projectId: string;
    componentName: string;
    action: string;
    metadata?: any;
  }): void {
    this.metricsBuffer.push({
      type: 'component-interaction',
      projectId: data.projectId,
      timestamp: new Date(),
      data
    });
  }
  
  /**
   * Get analytics dashboard data
   */
  async getDashboardData(projectId: string): Promise<DashboardData> {
    const [
      loadMetrics,
      errorMetrics,
      versionMetrics,
      performanceMetrics,
      interactionMetrics
    ] = await Promise.all([
      this.getLoadMetrics(projectId),
      this.getErrorMetrics(projectId),
      this.getVersionMetrics(projectId),
      this.getPerformanceMetrics(projectId),
      this.getInteractionMetrics(projectId)
    ]);
    
    return {
      loadMetrics,
      errorMetrics,
      versionMetrics,
      performanceMetrics,
      interactionMetrics,
      summary: this.calculateSummary(loadMetrics, errorMetrics)
    };
  }
  
  private async getLoadMetrics(projectId: string): Promise<LoadMetrics> {
    const result = await pool.query(
      `SELECT 
        AVG((data->>'loadTime')::float) as avg_load_time,
        MIN((data->>'loadTime')::float) as min_load_time,
        MAX((data->>'loadTime')::float) as max_load_time,
        COUNT(*) as total_loads,
        COUNT(*) FILTER (WHERE data->>'cached' = 'true') as cached_loads
      FROM component_metrics
      WHERE project_id = $1 
        AND type = 'component-load'
        AND timestamp > NOW() - INTERVAL '7 days'`,
      [projectId]
    );
    
    return {
      avg_load_time: result.rows[0].avg_load_time || 0,
      min_load_time: result.rows[0].min_load_time || 0,
      max_load_time: result.rows[0].max_load_time || 0,
      total_loads: parseInt(result.rows[0].total_loads) || 0,
      cached_loads: parseInt(result.rows[0].cached_loads) || 0
    };
  }
  
  private async getErrorMetrics(projectId: string): Promise<ErrorMetrics> {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE data->>'recovered' = 'true') as recovered_errors,
        COUNT(DISTINCT data->>'componentName') as affected_components,
        array_agg(DISTINCT data->>'error') as error_types
      FROM component_metrics
      WHERE project_id = $1 
        AND type = 'component-error'
        AND timestamp > NOW() - INTERVAL '7 days'`,
      [projectId]
    );
    
    return {
      total_errors: parseInt(result.rows[0].total_errors) || 0,
      recovered_errors: parseInt(result.rows[0].recovered_errors) || 0,
      affected_components: parseInt(result.rows[0].affected_components) || 0,
      error_types: result.rows[0].error_types || []
    };
  }
  
  private async getVersionMetrics(projectId: string): Promise<VersionMetrics> {
    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT version) as total_versions,
        MAX(created_at) as last_version_date,
        AVG((metadata->'performance'->>'bundleSize')::float) as avg_bundle_size,
        (SELECT version FROM component_versions 
         WHERE project_id = $1 AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1) as current_version
      FROM component_versions
      WHERE project_id = $1`,
      [projectId]
    );
    
    return {
      total_versions: parseInt(result.rows[0].total_versions) || 0,
      last_version_date: result.rows[0].last_version_date,
      avg_bundle_size: result.rows[0].avg_bundle_size || 0,
      current_version: result.rows[0].current_version || 'unknown'
    };
  }
  
  private async getPerformanceMetrics(projectId: string): Promise<PerformanceMetrics> {
    const result = await pool.query(
      `SELECT 
        AVG((data->>'reloadTime')::float) as avg_reload_time,
        COUNT(*) as total_reloads,
        COUNT(*) FILTER (WHERE data->>'success' = 'true') as successful_reloads,
        COUNT(*) FILTER (WHERE data->>'triggerType' = 'manual') as manual_reloads,
        COUNT(*) FILTER (WHERE data->>'triggerType' = 'automatic') as auto_reloads
      FROM component_metrics
      WHERE project_id = $1 
        AND type = 'hot-reload'
        AND timestamp > NOW() - INTERVAL '7 days'`,
      [projectId]
    );
    
    return {
      avg_reload_time: result.rows[0].avg_reload_time || 0,
      total_reloads: parseInt(result.rows[0].total_reloads) || 0,
      successful_reloads: parseInt(result.rows[0].successful_reloads) || 0,
      manual_reloads: parseInt(result.rows[0].manual_reloads) || 0,
      auto_reloads: parseInt(result.rows[0].auto_reloads) || 0
    };
  }
  
  private async getInteractionMetrics(projectId: string): Promise<InteractionMetrics> {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_interactions,
        COUNT(DISTINCT data->>'componentName') as unique_components,
        array_agg(DISTINCT data->>'action') as action_types,
        (SELECT data->>'action' FROM component_metrics 
         WHERE project_id = $1 AND type = 'component-interaction'
         GROUP BY data->>'action'
         ORDER BY COUNT(*) DESC LIMIT 1) as most_common_action
      FROM component_metrics
      WHERE project_id = $1 
        AND type = 'component-interaction'
        AND timestamp > NOW() - INTERVAL '7 days'`,
      [projectId]
    );
    
    return {
      total_interactions: parseInt(result.rows[0].total_interactions) || 0,
      unique_components: parseInt(result.rows[0].unique_components) || 0,
      action_types: result.rows[0].action_types || [],
      most_common_action: result.rows[0].most_common_action || 'none'
    };
  }
  
  private calculateSummary(
    loadMetrics: LoadMetrics, 
    errorMetrics: ErrorMetrics
  ): DashboardSummary {
    const errorRate = loadMetrics.total_loads > 0 
      ? (errorMetrics.total_errors / loadMetrics.total_loads) * 100 
      : 0;
    
    const cacheHitRate = loadMetrics.total_loads > 0 
      ? (loadMetrics.cached_loads / loadMetrics.total_loads) * 100 
      : 0;
    
    const health = errorRate < 1 ? 'excellent' : 
                   errorRate < 5 ? 'good' : 
                   errorRate < 10 ? 'fair' : 'needs-attention';
    
    return {
      health,
      errorRate,
      cacheHitRate,
      avgLoadTime: loadMetrics.avg_load_time || 0,
      recommendation: this.generateRecommendation(health, errorRate, cacheHitRate)
    };
  }
  
  private generateRecommendation(
    health: string, 
    errorRate: number, 
    cacheHitRate: number
  ): string {
    if (health === 'needs-attention') {
      return 'High error rate detected. Review recent component changes and error logs.';
    }
    if (cacheHitRate < 50) {
      return 'Low cache hit rate. Consider implementing better caching strategies.';
    }
    if (health === 'excellent') {
      return 'Components are performing excellently. Keep up the good work!';
    }
    return 'System is healthy. Monitor for any changes in performance.';
  }
  
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    try {
      // Batch insert metrics
      const values = metrics.map(m => [
        m.projectId || null,
        m.type,
        m.timestamp,
        JSON.stringify(m.data)
      ]);
      
      if (values.length > 0) {
        const placeholders = values.map((_, i) => 
          `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
        ).join(',');
        
        const flatValues = values.flat();
        
        await pool.query(
          `INSERT INTO component_metrics (project_id, type, timestamp, data) 
           VALUES ${placeholders}`,
          flatValues
        );
        
        console.log(`[Analytics] Flushed ${metrics.length} metrics to database`);
      }
    } catch (error) {
      console.error('[Analytics] Failed to flush metrics:', error);
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }
  
  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(
    projectId: string, 
    metricType: string, 
    days: number = 7
  ): Promise<TimeSeriesData[]> {
    const result = await pool.query(
      `SELECT 
        DATE_TRUNC('hour', timestamp) as time_bucket,
        COUNT(*) as count,
        AVG((data->>'loadTime')::float) as avg_value
      FROM component_metrics
      WHERE project_id = $1 
        AND type = $2
        AND timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY time_bucket
      ORDER BY time_bucket`,
      [projectId, metricType]
    );
    
    return result.rows.map(row => ({
      timestamp: row.time_bucket,
      count: parseInt(row.count),
      avgValue: row.avg_value || 0
    }));
  }
  
  destroy(): void {
    clearInterval(this.flushInterval);
    this.flushMetrics(); // Final flush
    console.log('[Analytics] Component analytics shut down');
  }
}

// Type definitions
interface MetricEvent {
  type: string;
  projectId?: string;
  timestamp: Date;
  data: any;
}

interface LoadMetrics {
  avg_load_time: number;
  min_load_time: number;
  max_load_time: number;
  total_loads: number;
  cached_loads: number;
}

interface ErrorMetrics {
  total_errors: number;
  recovered_errors: number;
  affected_components: number;
  error_types: string[];
}

interface VersionMetrics {
  total_versions: number;
  last_version_date: Date;
  avg_bundle_size: number;
  current_version: string;
}

interface PerformanceMetrics {
  avg_reload_time: number;
  total_reloads: number;
  successful_reloads: number;
  manual_reloads: number;
  auto_reloads: number;
}

interface InteractionMetrics {
  total_interactions: number;
  unique_components: number;
  action_types: string[];
  most_common_action: string;
}

interface DashboardSummary {
  health: 'excellent' | 'good' | 'fair' | 'needs-attention';
  errorRate: number;
  cacheHitRate: number;
  avgLoadTime: number;
  recommendation: string;
}

interface DashboardData {
  loadMetrics: LoadMetrics;
  errorMetrics: ErrorMetrics;
  versionMetrics: VersionMetrics;
  performanceMetrics: PerformanceMetrics;
  interactionMetrics: InteractionMetrics;
  summary: DashboardSummary;
}

interface TimeSeriesData {
  timestamp: Date;
  count: number;
  avgValue: number;
}

export const componentAnalytics = new ComponentAnalytics();