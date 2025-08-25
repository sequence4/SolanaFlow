import { NextFunction, Request, Response } from "express";
import pool from "../../config/database";
import { Connection, PublicKey } from "@solana/web3.js";
import { AppError } from "src/middleware/errorHandler";

export const getProgramStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'SELECT details FROM solanaproject WHERE id = $1',
        [id]
      );
      
      if (!result.rows.length) {
        res.json({ 
          deployed: false, 
          message: 'Project not found' 
        });
        return;
      }
      
      const details = result.rows[0]?.details;
      const programId = details?.projectState?.programId || details?.programId;
      const idl = details?.projectState?.idl;
      
      if (!programId) {
        res.json({ 
          deployed: false,
          message: 'No program ID found',
          hasIdl: false
        });
        return;
      }
      
      try {
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const programPubkey = new PublicKey(programId);
        const account = await connection.getAccountInfo(programPubkey);
        
        res.json({
          deployed: !!account,
          executable: account?.executable || false,
          owner: account?.owner?.toBase58() || null,
          programId,
          hasIdl: !!idl,
          idl: idl || null,
          rpcUrl
        });
      } catch (connectionError) {
        console.error('[getProgramStatus] RPC connection error:', connectionError);
        res.json({
          deployed: false,
          programId,
          hasIdl: !!idl,
          idl: idl || null,
          error: 'Failed to connect to Solana RPC'
        });
      }
    } catch (error) {
      console.error('[getProgramStatus] Database error:', error);
      next(new AppError('Failed to get program status', 500));
    }
  };