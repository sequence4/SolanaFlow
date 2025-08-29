import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { startInstallNodeDependenciesTask } from "../../utils/project/startInstallNodeDependenciesTask";

export const installNodeDependencies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { projectId } = req.params;
    const { packages } = req.body;
    const userId = req.user?.id ?? 'mock-user';
  
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