import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { getContainerName } from '../../utils/container/getContainerName';
import { getProjectRootPath } from '../../utils/fileUtils';
import { runCommand } from '../../utils/command-execution/runCommand';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';

/**
 * POST /projects/:id/switch-cluster
 * Switch between local and remote clusters
 */
export const switchProjectCluster = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      const { cluster, customUrl } = req.body;
      
      const containerName = await getContainerName(projectId);
      if (!containerName) {
        return next(new AppError('Container not found', 404));
      }
      
      const { getClusterConfig } = await import('../../utils/environment/clusterDetection');
      
      const clusterConfig = getClusterConfig(
        cluster as any,
        customUrl
      );
      
      const configCmd = `docker exec ${containerName} bash -c "
        solana config set --url ${clusterConfig.url} &&
        solana config set --commitment confirmed
      "`;
      await runCommand(configCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      const rootPath = await getProjectRootPath(projectId);
      const anchorTomlPath = `/usr/src/${rootPath}/Anchor.toml`;
      
      const updateAnchorCmd = `docker exec ${containerName} bash -c "
        sed -i 's|cluster = .*|cluster = \\"${cluster === 'local' ? 'localnet' : cluster}\\"|g' ${anchorTomlPath}
      "`;
      await runCommand(updateAnchorCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      const programId = cluster === 'local' 
        ? (await pool.query('SELECT details->\'localProgramId\' as pid FROM solanaproject WHERE id = $1', [projectId])).rows[0]?.pid
        : (await pool.query('SELECT details->\'programId\' as pid FROM solanaproject WHERE id = $1', [projectId])).rows[0]?.pid;
      
      const updateEnvCmd = `docker exec ${containerName} bash -c "
        cat > /usr/src/${rootPath}/web/.env.local << EOF
  NEXT_PUBLIC_CLUSTER=${cluster}
  NEXT_PUBLIC_RPC_URL=${clusterConfig.url}
  NEXT_PUBLIC_WEBSOCKET_URL=${clusterConfig.websocketUrl}
  NEXT_PUBLIC_PROGRAM_ID=${programId || ''}
  EOF
      "`;
      await runCommand(updateEnvCmd, '.', uuidv4(), { skipSuccessUpdate: true });
      
      await pool.query(
        `UPDATE solanaproject 
         SET details = jsonb_set(
           COALESCE(details, '{}'::jsonb),
           '{currentCluster}',
           $1::jsonb
         )
         WHERE id = $2`,
        [JSON.stringify(clusterConfig), projectId]
      );
      
      if (cluster === 'local') {
        const validatorStatus = await runCommand(
          `docker exec ${containerName} /usr/local/bin/start-validator.sh status`,
          '.', uuidv4(), { skipSuccessUpdate: true }
        ).catch(() => 'not-running');
        
        if (!validatorStatus.includes('running')) {
          await runCommand(
            `docker exec ${containerName} /usr/local/bin/start-validator.sh`,
            '.', uuidv4(), { skipSuccessUpdate: true }
          );
        }
      }
      
      res.json({
        message: `Switched to ${clusterConfig.name}`,
        cluster: clusterConfig,
        programId
      });
      
    } catch (error) {
      console.error('[SWITCH_CLUSTER] Error:', error);
      next(new AppError(`Failed to switch cluster: ${(error as Error).message}`, 500));
    }
  };