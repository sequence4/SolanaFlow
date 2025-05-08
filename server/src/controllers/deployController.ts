import { NextFunction, Request, Response } from "express";
import { AppError } from "src/middleware/errorHandler";
//import { runDeployPipeline } from "src/utils/deployUtils";

export async function deployPipeline(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const { id } = req.params;
    const { graph } = req.body;
    const userId = req.user?.id;
  
    if (!userId) return next(new AppError("User not found", 400));
  
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (data: unknown) =>
      res.write(`data: ${JSON.stringify(data)}\n\n`);
  
    try {
    /*
      await runDeployPipeline({
        projectId: id,
        userId,
        graph,
        sendProgress: send,
      });
    */
  
      send({ stage: "done" });
      res.end();
    } catch (err) {
      send({ stage: "error", message: (err as Error).message });
      res.end();
      next(err);
    }
  }