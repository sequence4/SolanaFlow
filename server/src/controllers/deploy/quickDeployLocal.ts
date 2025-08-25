import { NextFunction, Request, Response } from "express";
import { startLocalValidator } from "../blockchain/startLocalValidator";
import { getContainerName } from "../../utils/fileUtils";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import { deployToLocalValidator } from "./deployToLocalValidator";
import { getProjectRootPath } from "../../utils/fileUtils";
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
      
      // Step 1.5: Fix workspace issues before deployment
      const containerName = await getContainerName(projectId);
      if (containerName) {
        console.log('[QUICK_DEPLOY] Checking and fixing workspace configuration...');
        const rootPath = await getProjectRootPath(projectId);
        const fixCmd = `docker exec ${containerName} bash -c "
          cd /usr/src/${rootPath} &&
          # Ensure all programs are in workspace
          find programs -name 'Cargo.toml' -type f 2>/dev/null | while read prog; do
            dir=\\$(dirname \\$prog)
            if ! grep -q \\\"\\$dir\\\" Cargo.toml 2>/dev/null; then
              sed -i '/members = \\[/a\\\\    \\\"'\\$dir'\\\",' Cargo.toml
            fi
          done
        "`;
        await runCommand(fixCmd, '.', uuidv4(), { skipSuccessUpdate: true })
          .catch(err => console.warn('[QUICK_DEPLOY] Workspace fix warning:', err));
      }
      
      // Step 2: Deploy to local validator with retry logic
      let deployResult: any;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const deployReq = {
            params: { id: projectId },
            body: { walletPubkey, forceRebuild: retryCount > 0 }, // Force rebuild on retry
            user: req.user
          } as unknown as Request;
          
          deployResult = await new Promise<any>((resolve, reject) => {
            deployToLocalValidator(deployReq, {
              json: resolve,
              status: () => ({ json: resolve })
            } as any, reject);
          });
          
          break; // Success, exit retry loop
        } catch (deployError: any) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw deployError;
          }
          console.log(`[QUICK_DEPLOY] Retry ${retryCount}/${maxRetries} after error:`, deployError.message);
          
          // Clean workspace before retry
          if (containerName) {
            const rootPath = await getProjectRootPath(projectId);
            await runCommand(
              `docker exec ${containerName} bash -c "cd /usr/src/${rootPath} && cargo clean"`,
              '.', uuidv4(), { skipSuccessUpdate: true }
            ).catch(() => {}); // Ignore clean errors
          }
          
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
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