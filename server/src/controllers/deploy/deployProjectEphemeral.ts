import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { startAnchorDeployTask } from '../../utils/anchor/startAnchorDeployTask';
import { Keypair } from '@solana/web3.js';
import path from 'path';
import fs from 'fs';
import { APP_CONFIG } from '../../config/appConfig';
import pool from '../../config/database';
import { waitForTaskCompletion } from 'src/utils/taskUtils';

export const deployProjectEphemeral = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id ?? 'mock-user';
    const { ephemeralPubkey } = req.body;
  
    if (!ephemeralPubkey) return next(new AppError('Ephemeral public key is required', 400));
  
    if (ephemeralPubkey === 'SIGNED') {
      const program = Keypair.generate();
      const pubkey = program.publicKey.toBase58();
      const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${pubkey}.json`);
      fs.writeFileSync(walletPath, JSON.stringify(Array.from(program.secretKey)));
      const taskId = await startAnchorDeployTask(id, userId, 'SIGNED');
      res.status(200).json({
        message: 'Awaiting signed transaction from wallet',
        taskId: taskId,
        programId: pubkey
      });
      return;
    }
    
    try {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ephemeralPubkey)) {
        return next(new AppError('Invalid ephemeral public key format', 400));
      }
  
      const walletPath = path.join(APP_CONFIG.WALLETS_FOLDER, `${ephemeralPubkey}.json`);
      if (!fs.existsSync(walletPath)) {
        return next(new AppError(`Ephemeral key file not found. Please create it first.`, 404));
      }
    } catch (validationError: any) {
      console.error(`[DEPLOY_EPHEMERAL] Error validating ephemeral key:`, validationError);
      return next(new AppError(`Error validating ephemeral key: ${validationError.message}`, 400));
    }
  
    try {
      const projectCheck = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [id]
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
      } catch (err: any) {
        console.error('[DEPLOY_EPHEMERAL] Failed to parse details JSON:', err);
        return next(new AppError('Error parsing project details', 500));
      }
  
      const taskId = await startAnchorDeployTask(id, userId, ephemeralPubkey);
      const status = await waitForTaskCompletion(taskId, 120000);
        
        if (status === 'succeed' || status === 'finished') {
          const client = await pool.connect();
              let programId: string | null = null;
              try {
          const taskRes = await client.query('SELECT result FROM task WHERE id = $1', [taskId]);
          if (taskRes.rows.length && taskRes.rows[0].result) {
            try {
              const resultObj = JSON.parse(taskRes.rows[0].result);
              programId = resultObj.programId ?? null;
              } catch (e) {
              console.error('[DEPLOY_EPHEMERAL] Error parsing task result JSON:', e);
              }
              if (programId) {
                await client.query(
                  `UPDATE solanaproject
                   SET details = COALESCE(details::jsonb, '{}'::jsonb) || $1::jsonb,
                         last_updated = $2
                   WHERE id = $3`,
                [JSON.stringify({ programId }), new Date(), id]
              );
              }
            }
          } finally {
            client.release();
          }
        if (programId) {
          res.status(200).json({ success: true, programId, signatures: [] });
          return;
        } else {
          console.log(`[DEPLOY_EPHEMERAL] Task succeeded but no Program ID found.`);
          next(new AppError('Deployment finished but Program ID not found in result', 500));
          return;
        }
        } else if (status === 'failed') {
        console.warn(`[DEPLOY_EPHEMERAL] Deployment task failed.`);
        res.status(200).json({ success: false, error: 'Program deployment failed', programId: null, signatures: [] });
        return;
        } else if (status === 'timeout') {
        console.warn(`[DEPLOY_EPHEMERAL] Deployment task timed out.`);
        res.status(200).json({ success: false, error: 'Deployment timed out', programId: null, signatures: [] });
        return;
      } else {
        // Should not happen (covers any other status)
        res.status(200).json({ success: false, error: `Deployment ended with status: ${status}`, programId: null, signatures: [] });
        return;
      }
    } catch (error: any) {
      console.error('[DEPLOY_EPHEMERAL] Error in deployProjectEphemeral:', error);
      return next(new AppError('Ephemeral deployment process failed', 500));
    }
  };