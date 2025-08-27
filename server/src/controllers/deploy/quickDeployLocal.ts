import { NextFunction, Request, Response } from "express";
import { startLocalValidator } from "../blockchain/startLocalValidator";
import { deployToLocalValidator } from "./deployToLocalValidator";
import { AppError } from "src/middleware/errorHandler";

/**
 * POST /projects/:id/local-validator/quick-deploy
 * One-click local deployment with automatic setup
 */
export const quickDeployLocal = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: projectId } = req.params;
      const { walletPubkey, resetValidator = false } = req.body;
      
      console.log(`[QUICK_DEPLOY] Starting quick local deployment for project ${projectId}`);
      
      // Step 1: Start or reset validator
      const startValidatorReq = {
        params: { id: projectId },
        body: { reset: resetValidator, walletPubkey },
        user: req.user
      } as unknown as Request;
      
      await new Promise((resolve, reject) => {
        startLocalValidator(startValidatorReq, {
          json: resolve,
          status: () => ({ json: resolve })
        } as any, reject);
      });
      
      // Wait for validator to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Deploy to local validator (no retry needed since we're not building)
      const deployReq = {
        params: { id: projectId },
        body: { walletPubkey },
        user: req.user
      } as unknown as Request;
      
      const deployResult = await new Promise<any>((resolve, reject) => {
        deployToLocalValidator(deployReq, {
          json: resolve,
          status: () => ({ json: resolve })
        } as any, reject);
      });
      
      res.json({
        message: 'Quick local deployment completed',
        ...deployResult,
        validatorReset: resetValidator
      });
      
    } catch (error) {
      console.error('[QUICK_DEPLOY] Error:', error);
      next(new AppError(`Quick deployment failed: ${(error as Error).message}`, 500));
    }
  };