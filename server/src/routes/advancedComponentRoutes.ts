/**
 * Advanced Component Management Routes
 * API endpoints for versioning, AI generation, and analytics
 */

import express, { RequestHandler } from 'express';
import { componentVersionManager } from '../utils/versioning/componentVersionManager';
import { aiComponentGenerator } from '../utils/ai/aiComponentGenerator';
import { componentAnalytics } from '../utils/analytics/componentAnalytics';

const router = express.Router();

// ===== Version Management Routes =====

// Get version history for a project
router.get('/projects/:projectId/versions', (async (req, res) => {
  try {
    const { projectId } = req.params;
    const versions = await componentVersionManager.getVersionHistory(projectId);
    res.json({ success: true, versions });
  } catch (error: any) {
    console.error('[API] Failed to get version history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Rollback to a specific version
router.post('/projects/:projectId/versions/rollback', (async (req, res) => {
  try {
    const { projectId } = req.params;
    const { targetVersion } = req.body;
    
    if (!targetVersion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Target version is required' 
      });
    }
    
    await componentVersionManager.rollbackToVersion(projectId, targetVersion);
    
    res.json({ 
      success: true, 
      message: `Successfully rolled back to version ${targetVersion}` 
    });
  } catch (error: any) {
    console.error('[API] Rollback failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Compare two versions
router.get('/projects/:projectId/versions/compare', (async (req, res) => {
  try {
    const { projectId } = req.params;
    const { v1, v2 } = req.query;
    
    if (!v1 || !v2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both v1 and v2 parameters are required' 
      });
    }
    
    const comparison = await componentVersionManager.compareVersions(
      projectId, 
      v1 as string, 
      v2 as string
    );
    
    res.json({ success: true, comparison });
  } catch (error: any) {
    console.error('[API] Version comparison failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// ===== AI Generation Routes =====

// Generate component from description
router.post('/ai/generate-component', (async (req, res) => {
  try {
    const { description, context } = req.body;
    
    if (!description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Description is required' 
      });
    }
    
    if (!aiComponentGenerator.isEnabled()) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI generation is not available. Please configure ANTHROPIC_API_KEY.' 
      });
    }
    
    const component = await aiComponentGenerator.generateFromDescription(
      description,
      context || {}
    );
    
    res.json({ success: true, component });
  } catch (error: any) {
    console.error('[API] AI generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Optimize existing component
router.post('/ai/optimize-component', (async (req, res) => {
  try {
    const { componentCode, goals } = req.body;
    
    if (!componentCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Component code is required' 
      });
    }
    
    if (!aiComponentGenerator.isEnabled()) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI optimization is not available. Please configure ANTHROPIC_API_KEY.' 
      });
    }
    
    const optimized = await aiComponentGenerator.optimizeComponent(
      componentCode,
      goals || ['performance']
    );
    
    res.json({ success: true, optimized });
  } catch (error: any) {
    console.error('[API] Optimization failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Generate documentation
router.post('/ai/generate-docs', (async (req, res) => {
  try {
    const { componentCode, componentName } = req.body;
    
    if (!componentCode || !componentName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both component code and name are required' 
      });
    }
    
    const documentation = await aiComponentGenerator.generateDocumentation(
      componentCode,
      componentName
    );
    
    res.json({ success: true, documentation });
  } catch (error: any) {
    console.error('[API] Documentation generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// ===== Analytics Routes =====

// Get analytics dashboard data
router.get('/projects/:projectId/analytics', (async (req, res) => {
  try {
    const { projectId } = req.params;
    const dashboard = await componentAnalytics.getDashboardData(projectId);
    res.json({ success: true, dashboard });
  } catch (error: any) {
    console.error('[API] Failed to get analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Get time series data for charts
router.get('/projects/:projectId/analytics/timeseries', (async (req, res) => {
  try {
    const { projectId } = req.params;
    const { metricType, days } = req.query;
    
    if (!metricType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Metric type is required' 
      });
    }
    
    const data = await componentAnalytics.getTimeSeriesData(
      projectId,
      metricType as string,
      parseInt(days as string) || 7
    );
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[API] Failed to get time series data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// Track metrics from frontend
router.post('/analytics/track', (async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both type and data are required' 
      });
    }
    
    switch (type) {
      case 'component-load':
        componentAnalytics.trackComponentLoad(data);
        break;
      case 'hot-reload':
        componentAnalytics.trackHotReload(data);
        break;
      case 'error':
        componentAnalytics.trackError(data);
        break;
      case 'interaction':
        componentAnalytics.trackInteraction(data);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown metric type: ${type}` 
        });
    }
    
    res.json({ success: true, message: 'Metric tracked successfully' });
  } catch (error: any) {
    console.error('[API] Failed to track metric:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}) as RequestHandler);

// ===== Health Check =====

// Check status of advanced features
router.get('/health', (async (_req, res) => {
  res.json({
    success: true,
    features: {
      versioning: 'enabled',
      ai: aiComponentGenerator.isEnabled() ? 'enabled' : 'disabled',
      analytics: 'enabled',
      timestamp: new Date().toISOString()
    }
  });
}) as RequestHandler);

export default router;