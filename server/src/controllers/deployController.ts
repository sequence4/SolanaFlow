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
  
    console.log(`[API] Deploy pipeline called for project: ${id}, userId: ${userId}`);
    console.log(`[API] Graph data received:`, JSON.stringify(graph).substring(0, 200) + '...');
  
    if (!userId) {
      console.log(`[API] Deploy failed - no userId found`);
      return next(new AppError("User not found", 400));
    }
  
    console.log(`[API] Setting up SSE response headers`);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    
    const send = (data: unknown) => {
      console.log(`[API] Sending SSE event:`, data);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  
    try {
      console.log(`[API] Starting deploy pipeline process`);
    /*
      await runDeployPipeline({
        projectId: id,
        userId,
        graph,
        sendProgress: send,
      });
    */
      
      // Send some simulated progress events for testing
      send({ stage: "environment", message: "Preparing your build environment…" });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      send({ stage: "code-gen", message: "Generating Anchor code…" });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      send({ stage: "build", message: "Building program…" });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      send({ stage: "deploy", message: "Deploying / upgrading…" });
      await new Promise(resolve => setTimeout(resolve, 1000));
  
      send({ stage: "done" });
      console.log(`[API] Deploy pipeline completed successfully`);
      res.end();
    } catch (err) {
      console.error(`[API] Deploy pipeline error:`, err);
      send({ stage: "error", message: (err as Error).message });
      res.end();
      next(err);
    }
  }