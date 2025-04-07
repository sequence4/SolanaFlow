import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { 
    createFileInContainer, 
    updateFileInContainer, 
    getFileContentFromContainer, 
    installDependenciesInContainer 
} from '../utils/containerFileUtils';

export const createFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId } = req.params;
  const { filePath, content } = req.body;
  const userId = req.user?.id;

  try {
    if (!projectId || !filePath || !content) {
      return next(new AppError('Missing required parameters', 400));
    }
    
    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    const response = await createFileInContainer(projectId, filePath, content, userId);

    res.status(200).json({
      message: 'File creation started',
      taskId: response.taskId
    });
  } catch (error) {
    next(error);
  }
};

export const updateFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId, filePath } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;

  try {
    if (!projectId || !filePath || !content) {
      return next(new AppError('Missing required parameters', 400));
    }
    
    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    const response = await updateFileInContainer(projectId, filePath, content, userId);

    res.status(200).json({
      message: 'File update started',
      taskId: response.taskId
    });
  } catch (error) {
    next(error);
  }
};

export const getFileContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId, filePath } = req.params;
  const userId = req.user?.id;

  try {
    if (!projectId || !filePath) {
      return next(new AppError('Missing required parameters', 400));
    }
    
    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    const response = await getFileContentFromContainer(projectId, filePath, userId);

    res.status(200).json({
      message: 'File content retrieval started',
      taskId: response.taskId
    });
  } catch (error) {
    next(error);
  }
};

export const installDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { projectId } = req.params;
  const { packages, targetDir = 'app' } = req.body;
  const userId = req.user?.id;

  try {
    if (!projectId || !Array.isArray(packages) || packages.length === 0) {
      return next(new AppError('Missing required parameters', 400));
    }
    
    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    const response = await installDependenciesInContainer(projectId, packages, userId, targetDir);

    res.status(200).json({
      message: 'Package installation started',
      taskId: response.taskId
    });
  } catch (error) {
    next(error);
  }
}; 