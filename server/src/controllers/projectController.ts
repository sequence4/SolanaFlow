import { NextFunction, Request, Response, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getProjectRootPath, startDeleteProjectFolderTask } from '../utils/fileUtils';
import { startProjectContainer } from '../utils/projectUtils';
import { normalizeProjectName } from '../utils/stringUtils';
import {
  startAnchorBuildTask,
  startAnchorDeployTask,
  startAnchorInitTask,
  startAnchorTestTask,
  startCustomCommandTask,
  startInstallPackagesTask,
  getBuildArtifactTask,
  startSetClusterTask,
  runCommand,
  startCreateProjectDirectoryTask,
  startInstallNodeDependenciesTask,
  compileTs,
  closeProjectContainer,
} from '../utils/projectUtils';
import path from 'path';
import { APP_CONFIG } from '../config/appConfig';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import { createTask, updateTaskStatus, waitForTaskCompletion } from '../utils/taskUtils';
import os from 'os';

export const runCommandController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { command, cwd } = req.body;

    if (!command || !cwd) {
      return next(
        new AppError('You must provide both "command" and "cwd" in the request body.', 400)
      );
    }

    const taskId = uuidv4();
    const output = await runCommand(command, cwd, taskId);

    res.status(200).json({
      message: 'Command executed successfully.',
      command,
      cwd,
      taskId,
      output
    });
  } catch (error) {
    return next(error);
  }
};

export const compileTsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tsFileName } = req.body;
    if (!tsFileName) {
      return next(new AppError('No .ts filename provided', 400));
    }

    const compileCwd = "/absolute/path/to/backend/src/data/nodes/off-chain/nft-metaplex";
    const jsContent = await compileTs(tsFileName, compileCwd, "dist");

    res.status(200).json({
      message: 'Compile & fetch success',
      jsContent,
    });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { 
    name, 
    description, 
    details 
  } = req.body;
  const org_id = req.user?.org_id;
  const userId = req.user?.id;

  console.log(`[DEBUG_CODE_ENDPOINT] Received request to createProject with name=${name}, description=${description?.substring(0, 20)}..., userId=${userId}, org_id=${org_id}`);

  if (!org_id || !userId) {
    console.log(`[DEBUG_CODE_ENDPOINT] createProject failed - missing org_id or userId`);
    next(new AppError('User organization not found', 400));
    return;
  }

  const client = await pool.connect();
  let projectCreated = false;
  let projectId: string | null = null;

  try {
    await client.query('BEGIN');

    const normalizedName = normalizeProjectName(name);
    const randomSuffix = uuidv4().slice(0, 8);
    const root_path = `${normalizedName}-${randomSuffix}`;
    console.log(`[DEBUG_CODE_ENDPOINT] Generated root_path=${root_path} for project name=${name}`);

    const extendedDetails = {
      ...(details || {}),
      isLite: true,
    };

    projectId = uuidv4();
    console.log(`[DEBUG_CODE_ENDPOINT] Generated projectId=${projectId}`);

    const result = await client.query(
      'INSERT INTO solanaproject (id, name, description, org_id, root_path, details, last_updated, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *',
      [projectId, name, description, org_id, root_path, JSON.stringify(extendedDetails), new Date()]
    );

    const newProject = result.rows[0];
    console.log(`[DEBUG_CODE_ENDPOINT] Project inserted in DB, id=${newProject.id}, root_path=${newProject.root_path}`);
    
    await client.query('COMMIT');
    projectCreated = true;
    console.log(`[DEBUG_CODE_ENDPOINT] Transaction committed for projectId=${projectId}`);
    
    let taskId: string;
    try {
      console.log(`[DEBUG_CODE_ENDPOINT] About to start createProjectDirectoryTask for projectId=${projectId}, root_path=${root_path}`);
      taskId = await startCreateProjectDirectoryTask(userId, root_path, projectId);
      console.log(`[DEBUG_CODE_ENDPOINT] Created directory task with taskId=${taskId} for projectId=${projectId}`);
    } catch (taskError: any) {
      console.error('[DEBUG_CODE_ENDPOINT] Error creating project directory task:', taskError);
      res.status(201).json({
        message: 'Project created successfully, but directory creation failed',
        project: {
          id: newProject.id.toString(),
          name: newProject.name,
          description: newProject.description,
          org_id: newProject.org_id,
          root_path: newProject.root_path,
          details: newProject.details,
          last_updated: newProject.last_updated,
          created_at: newProject.created_at
        },
        directoryTaskError: taskError.message
      });
      return;
    }

    console.log(`[DEBUG_CODE_ENDPOINT] Responding with success for projectId=${projectId}, taskId=${taskId}`);
    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: newProject.id.toString(),
        name: newProject.name,
        description: newProject.description,
        org_id: newProject.org_id,
        root_path: newProject.root_path,
        details: newProject.details,
        last_updated: newProject.last_updated,
        created_at: newProject.created_at
      },
      directoryTask: {
        taskId: taskId,
        message: 'Project directory creation started'
      }
    });

  } catch (error) {
    if (!projectCreated) {
      await client.query('ROLLBACK');
      console.log(`[DEBUG_CODE_ENDPOINT] Transaction rolled back due to error`);
    }
    console.error('[DEBUG_CODE_ENDPOINT] Error in createProject:', error);
    next(error);
  } finally {
    client.release();
  }
};

export const createProjectDirectory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const org_id = req.user?.org_id;
  const userId = req.user?.id;

  if (!org_id || !userId) return next(new AppError('User organization not found', 400)); 

  try {
    const { name, description, projectId = '' } = req.body;
    
    if (!name) {
      return next(new AppError('Project name is required', 400));
    }

    const normalizedName = normalizeProjectName(name);
    const randomSuffix = uuidv4().slice(0, 8);
    const root_path = `${normalizedName}-${randomSuffix}`;
    
    if (projectId) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT id FROM solanaproject WHERE id = $1',
          [projectId]
        );
        
        if (result.rows.length === 0) {
          return next(new AppError('Project ID not found', 404));
        }
      } finally {
        client.release();
      }
    }
    
    console.log("user id", userId);
    console.log("root path", root_path);
    const taskId = await startCreateProjectDirectoryTask(userId, root_path, projectId);
    
    res.status(200).json({
      message: 'Project directory creation started',
      rootPath: root_path,
      taskId: taskId
    });
  } catch (error) {
    console.error('Error in createProjectDirectory:', error);
    return next(new AppError('Failed to start project directory creation', 500));
  }
};

export const editProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { name, description, details } = req.body;
  const org_id = req.user?.org_id;

  if (!org_id) {
    return next(new AppError('User organization not found', 400));
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectCheck = await client.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, org_id]
    );

    if (projectCheck.rows.length === 0) {
      throw new AppError(
        'Project not found or you do not have permission to edit it',
        404
      );
    }

    let updateQuery = 'UPDATE solanaproject SET last_updated = NOW()';
    const updateValues = [];
    let valueIndex = 1;

    if (name !== undefined) {
      updateQuery += `, name = $${valueIndex}`;
      updateValues.push(name);
      valueIndex++;
    }

    if (description !== undefined) {
      updateQuery += `, description = $${valueIndex}`;
      updateValues.push(description);
      valueIndex++;
    }

    if (details !== undefined) {
      updateQuery += `, details = $${valueIndex}`;
      updateValues.push(JSON.stringify(details));
      valueIndex++;
    }

    updateQuery += ` WHERE id = $${valueIndex} AND org_id = $${
      valueIndex + 1
    } RETURNING *`;
    updateValues.push(id, org_id);

    const result = await client.query(updateQuery, updateValues);

    await client.query('COMMIT');

    const updatedProject = result.rows[0];
    res.status(200).json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in editProject:', error);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to update project', 500));
    }
  } finally {
    client.release();
  }
};

export const getProjectDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  console.log(`[DEBUG_PROJECT] getProjectDetails called for id=${id}, userId=${userId}, orgId=${orgId}`);

  if (!userId || !orgId) {
    console.log(`[DEBUG_PROJECT] getProjectDetails failed - missing userId or orgId`);
    next(new AppError('User information not found', 400));
    return;
  }

  try {
    console.log(`[DEBUG_PROJECT] Querying database for project id=${id}`);
    const projectResult = await pool.query(
      `
      SELECT id, name, description, org_id, root_path, details, container_url, last_updated, created_at
      FROM solanaproject
      WHERE id = $1 AND org_id = $2
    `,
      [id, orgId]
    );

    if (projectResult.rows.length === 0) {
      console.log(`[DEBUG_PROJECT] No project found for id=${id}, orgId=${orgId}`);
      next(
        new AppError('Project not found or you do not have permission to access it', 404)
      );
      return;
    }

    const project = projectResult.rows[0];
    console.log(`[DEBUG_PROJECT] Found project id=${project.id}, name=${project.name}, container_url=${project.container_url || 'undefined'}`);

    const projectContext = {
      id: project.id,
      name: project.name,
      description: project.description,
      rootPath: project.root_path || '',
      details: project.details || {},
      containerUrl: project.container_url || "",
    };
    
    console.log(`[DEBUG_PROJECT] Responding with projectContext:`, {
      id: projectContext.id,
      name: projectContext.name,
      containerUrl: projectContext.containerUrl,
      detailsKeys: projectContext.details ? Object.keys(projectContext.details) : []
    });

    res.status(200).json({
      message: 'Project details retrieved successfully',
      project: projectContext,
    });
  } catch (error) {
    console.error('[DEBUG_PROJECT] Error in getProjectDetails:', error);
    next(error);
  }
};

export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    next(new AppError('User information not found', 400));
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userCheck = await client.query(
      'SELECT role FROM Creator WHERE id = $1 AND org_id = $2',
      [userId, orgId]
    );

    if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'admin') {
      throw new AppError('Only admin users can delete projects', 403);
    }

    const projectCheck = await client.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      throw new AppError(
        'Project not found or you do not have permission to delete it',
        404
      );
    }

    const containerTaskId = await closeProjectContainer(
      id,
      userId,
      false,
      true
    );

    await client.query('DELETE FROM solanaproject WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.status(200).json({
      message: 'Project deleted successfully',
      containerTaskId: containerTaskId,
    });
    
    return;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteProject:', error);
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to delete project', 500));
    }
  } finally {
    client.release();
  }
};

export const anchorInitProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const org_id = req.user?.org_id;
  const userId = req.user?.id;
  if (!org_id || !userId) {
    return next(new AppError('User organization not found', 400));
  }

  const { projectId, projectName} = req.body;

  try {
    const projectResult = await pool.query(
      `SELECT details FROM solanaproject WHERE id = $1`,
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return next(new AppError('Project not found', 404));
    }

    const { details: detailsStr } = projectResult.rows[0];
    
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err) {
      console.error('Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    if ((details as any).isLite === true) {
      console.log('Skipping Anchor initialization for lite project');
      res.status(200).json({ 
        message: 'Operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const rootPath = await getProjectRootPath(projectId);
    if(!rootPath) {
      return next(new AppError('Project root path not found', 400));
    }
    
    const taskId = await startAnchorInitTask(projectId, rootPath, projectName, userId);

    res.status(200).json({
      message: 'Anchor project initialization started successfully',
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const setCluster = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    return next(new AppError('User information not found', 400));
  }

  try {
    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(new AppError('Project not found or no permission to access it', 404));
    }

    const taskId = await startSetClusterTask(id, userId);

    res.status(200).json({
      message: 'Anchor config set cluster devnet process started',
      taskId,
    });
  } catch (error) {
    console.error('Error in setCluster controller:', error);
    next(new AppError('Failed to set cluster devnet', 500));
  }
};

export const buildProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    return next(new AppError('User information not found', 400));
  }
  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    const { details: detailsStr } = projectCheck.rows[0];
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err) {
      console.error('Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    if ((details as any).isLite === true) {
      console.log('Skipping build process for lite project');
      res.status(200).json({ 
        message: 'Build operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const taskId = await startAnchorBuildTask(id, userId);

    res.status(200).json({
      message: 'Anchor build process started',
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getBuildArtifact = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) return next(new AppError('User information not found', 400));

  try {
    const artifact = await getBuildArtifactTask(id);
    res.status(200).json({
      status: 'success',
      base64So: artifact.base64So,
    });
  } catch (error) {
    next(error);
  }
};

export const createEphemeralKeypair = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ephemeral = Keypair.generate();
    const ephemeralPubkeyString = ephemeral.publicKey.toBase58();

    const ephemeralFilePath = path.join(APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkeyString}.json`);
    fs.writeFileSync(ephemeralFilePath, JSON.stringify([...ephemeral.secretKey]));

    console.log(`Created ephemeral keypair with public key ${ephemeralPubkeyString} and saved to ${ephemeralFilePath}`);

    res.status(200).json({
      ephemeralPubkey: ephemeralPubkeyString
    });
  } catch (err) {
    console.error('Error creating ephemeral keypair:', err);
    return next(new AppError('Failed to create ephemeral keypair', 500));
  }
};

export const deployProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) return next(new AppError('User information not found', 400));

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to deploy it',
          404
        )
      );
    }

    const { details: detailsStr } = projectCheck.rows[0];
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err) {
      console.error('Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    const taskId = await startAnchorDeployTask(id, userId);

    res.status(200).json({
      message: 'Anchor deploy process started',
      taskId: taskId,
    });
  } catch (error) {
    console.error('Error in deployProject:', error);
    return next(new AppError('Failed to start deployment process', 500));
  }
};

export const deployProjectEphemeral = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;
  const { ephemeralPubkey } = req.body;

  console.log(`[DEPLOY_EPHEMERAL] Received request to deploy project ${id} with ephemeral key ${ephemeralPubkey}`);

  if (!userId || !orgId) {
    console.log(`[DEPLOY_EPHEMERAL] Missing user info: userId=${userId}, orgId=${orgId}`);
    return next(new AppError('User information not found', 400));
  }

  if (!ephemeralPubkey) {
    console.log(`[DEPLOY_EPHEMERAL] No ephemeral public key provided in request`);
    return next(new AppError('Ephemeral public key is required', 400));
  }

  // Validate the ephemeral public key
  try {
    console.log(`[DEPLOY_EPHEMERAL] Validating ephemeral key format`);
    // Check if the key is in the expected format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ephemeralPubkey)) {
      console.log(`[DEPLOY_EPHEMERAL] Invalid ephemeral key format: ${ephemeralPubkey}`);
      return next(new AppError('Invalid ephemeral public key format', 400));
    }

    // Check if the key file exists
    const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
    if (!fs.existsSync(walletPath)) {
      console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file not found at ${walletPath}`);
      return next(new AppError(`Ephemeral key file not found. Please create it first.`, 404));
    }
    console.log(`[DEPLOY_EPHEMERAL] Ephemeral key file exists at ${walletPath}`);
  } catch (validationError: any) {
    console.error(`[DEPLOY_EPHEMERAL] Error validating ephemeral key:`, validationError);
    return next(new AppError(`Error validating ephemeral key: ${validationError.message}`, 400));
  }

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      console.log(`[DEPLOY_EPHEMERAL] Project not found or no permission: id=${id}, orgId=${orgId}`);
      return next(
        new AppError(
          'Project not found or you do not have permission to deploy it',
          404
        )
      );
    }

    const { details: detailsStr } = projectCheck.rows[0];
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err: any) {
      console.error('[DEPLOY_EPHEMERAL] Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    console.log(`[DEPLOY_EPHEMERAL] Starting anchor deploy task with ephemeral key ${ephemeralPubkey}`);
    const taskId = await startAnchorDeployTask(id, userId, ephemeralPubkey);
    console.log(`[DEPLOY_EPHEMERAL] Deploy task started: ${taskId}`);

    // Wait for task completion and validate result before sending response
    try {
      console.log(`[DEPLOY_EPHEMERAL] Waiting for task ${taskId} to complete...`);
      const status = await waitForTaskCompletion(taskId, 120000); // 2 minute timeout
      console.log(`[DEPLOY_EPHEMERAL] Task ${taskId} completed with status: ${status}`);
      
      if (status === 'succeed' || status === 'finished') {
        // Fetch the task's result from the database
        const client = await pool.connect();
        try {
          const taskQuery = await client.query(
            'SELECT result FROM Task WHERE id = $1',
            [taskId]
          );
          
          if (taskQuery.rows.length > 0 && taskQuery.rows[0].result) {
            const programId = taskQuery.rows[0].result;
            console.log(`[DEPLOY_EPHEMERAL] Task result: '${programId}'`);            
            console.log(`[DEPLOY_EPHEMERAL] Valid program ID confirmed: ${programId}`);
          } else {
            console.log(`[DEPLOY_EPHEMERAL] WARNING: Task completed but returned null or empty result`);
          }
        } finally {
          client.release();
        }
      } else if (status === 'failed') {
        console.log(`[DEPLOY_EPHEMERAL] WARNING: Task completed with failed status`);
      } else if (status === 'timeout') {
        console.log(`[DEPLOY_EPHEMERAL] WARNING: Task timed out waiting for completion`);
      }
    } catch (waitError: any) {
      console.log(`[DEPLOY_EPHEMERAL] Error waiting for task completion: ${waitError.message}`);
      // Continue sending response with taskId, client will poll for completion
    }

    res.status(200).json({
      message: 'Ephemeral anchor deploy process started',
      taskId: taskId,
    });
  } catch (error: any) {
    console.error('[DEPLOY_EPHEMERAL] Error in deployProjectEphemeral:', error);
    return next(new AppError('Failed to start ephemeral deployment process', 500));
  }
};

export const testProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    return next(new AppError('User information not found', 400));
  }

  try {
    const projectCheck = await pool.query(
      'SELECT details FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    const { details: detailsStr } = projectCheck.rows[0];
    let details = {};
    try {
      if (typeof detailsStr === 'object' && detailsStr !== null) {
        details = detailsStr;
      } else {
        details = JSON.parse(detailsStr || '{}');
      }
    } catch (err) {
      console.error('Failed to parse details JSON:', err);
      return next(new AppError('Error parsing project details', 500));
    }

    if ((details as any).isLite === true) {
      console.log('Skipping test process for lite project');
      res.status(200).json({ 
        message: 'Test operation skipped for lite project',
        isLite: true
      });
      return;
    }

    const taskId = await startAnchorTestTask(id, userId);

    res.status(200).json({
      message: 'Anchor test process started',
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const runProjectCommand = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { commandType, functionName, parameters, requiresUmi } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.org_id;
    
    const { ephemeralPubkey } = req.body;

    if (!userId || !orgId) {
      return next(new AppError('User information not found', 400));
    }

    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    if (functionName) {
      console.log(`Executing function ${functionName} with parameters:`, parameters);
      console.log(`UMI required: ${requiresUmi}`);
      
      const taskId = await startCustomCommandTask(id, userId, 'runFunction', functionName, parameters, ephemeralPubkey);
      
      res.status(200).json({
        message: `Function execution started`,
        taskId: taskId,
      });
      return;
    }

    if (!['anchor clean', 'cargo clean'].includes(commandType)) {
      return next(new AppError('Invalid command type', 400));
    }

    const taskId = await startCustomCommandTask(id, userId, commandType);

    res.status(200).json({
      message: `${commandType} process started`,
      taskId: taskId,
    });
  } catch (error) {
    return next(error);
  }
};

export const installPackages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { packages } = req.body;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) return next(new AppError('User information not found', 400));
  
  try {
    const projectCheck = await pool.query(
      'SELECT * FROM solanaproject WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (projectCheck.rows.length === 0) {
      return next(
        new AppError(
          'Project not found or you do not have permission to access it',
          404
        )
      );
    }

    const taskId = await startInstallPackagesTask(id, userId, packages);

    res.status(200).json({
      message: 'NPM packages installation started successfully',
      taskId: taskId,
    });
  } catch (error) {
    console.error('Error in installPackages:', error);
    next(new AppError('Failed to start package installation process', 500));
  }
};

export const installNodeDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId } = req.params;
  const { packages } = req.body;
  const userId = req.user?.id;
  const orgId = req.user?.org_id;

  if (!userId || !orgId) {
    return next(new AppError('User information not found', 400));
  }

  if (!packages || !Array.isArray(packages)) {
    return next(new AppError('Packages array is required', 400));
  }

  try {
    const taskId = await startInstallNodeDependenciesTask(projectId, userId, packages);

    res.status(200).json({
      message: 'Dependency installation process started',
      taskId,
    });
  } catch (error) {
    next(error);
  }
};

export const startContainer = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    return next(new AppError('User not found', 400));
  }

  try {
    const taskId = await startProjectContainer(id, userId);
    
    res.status(200).json({
      message: 'Container start process initiated',
      taskId
    });
  } catch (error) {
    next(error);
  }
};


