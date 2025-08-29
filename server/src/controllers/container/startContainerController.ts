import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { startProjectContainer } from "../../utils/container";

export const startContainerController = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return next(new AppError('User not found', 400));
    }
  
    try {
      const container = await startProjectContainer(id);
      
      res.status(200).json({
        message: 'Container start process initiated',
        containerName: container.containerName,
        containerUrl: container.containerUrl
      });
    } catch (error) {
      next(error);
    }
  };