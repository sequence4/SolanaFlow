import { NextFunction, Request, Response } from "express";
import { createProject as createProjectDb } from "../../utils/project/createProject";

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description } = req.body;
    const details = req.body.details ?? {};
    const safeName = (name && name.trim()) ? name : `Untitled-${new Date().toISOString().slice(0,10)}`;

    const project = await createProjectDb({ 
      name: safeName, 
      description, 
      details 
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (err) {
    next(err);
  }
};