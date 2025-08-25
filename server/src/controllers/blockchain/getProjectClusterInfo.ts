import { NextFunction, Request, Response } from 'express';
import pool from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

/**
 * GET /projects/:id/cluster-info
 * Get current cluster configuration for the project
 */
export const getProjectClusterInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      const { preferLocal } = req.query;
      
      const { getProjectCluster, testClusterConnection } = await import('../../utils/environment/clusterDetection');
      
      const projectResult = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        return next(new AppError('Project not found', 404));
      }
      
      const details = projectResult.rows[0].details || {};
      const hasLocalDeployment = !!details.localProgramId;
      const hasDevnetDeployment = !!details.programId;
      
      const cluster = await getProjectCluster(
        projectId, 
        preferLocal === 'true' || hasLocalDeployment
      );
      
      const connectionTest = await testClusterConnection(cluster.url);
      
      const programIds = {
        local: details.localProgramId || null,
        devnet: details.programId || details.projectState?.programId || null
      };
      
      res.json({
        cluster,
        connectionTest,
        programIds,
        hasLocalDeployment,
        hasDevnetDeployment,
        recommendedCluster: hasLocalDeployment ? 'local' : 'devnet'
      });
      
    } catch (error) {
      console.error('[CLUSTER_INFO] Error:', error);
      next(new AppError('Failed to get cluster info', 500));
    }
  };
  