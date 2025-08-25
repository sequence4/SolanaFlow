import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { getBuildArtifactTask } from "../../utils/anchor/getBuildArtefactTask";

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