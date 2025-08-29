import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { compileTs } from "../../utils/compilation/compileTs";

export const compileTsController  = async (
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