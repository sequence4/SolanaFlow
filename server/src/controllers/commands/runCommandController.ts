import { NextFunction, Request, Response } from "express";
import { runCommand } from "../../utils/command-execution/runCommand";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../middleware/errorHandler";

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
        output,
      });
      return;
    } catch (error) {
      return next(error);
    }
  };