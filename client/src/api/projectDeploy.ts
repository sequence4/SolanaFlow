"use client";
import { api } from "./apiHelper";
import { streamTaskStatus } from "./taskStream";
import { TaskEvent } from "./taskStream";

/* 1 – wrapper: create an ephemeral key (already exists via projectApi) */
export const createEphemeralKey = (projectId: string) =>
  api.post<{ ephemeralPubkey: string }>(`/projects/${projectId}/ephemeral`)
     .then(r => r.data.ephemeralPubkey);

/* 2 – wrapper: start backend deploy and get taskId */
export const deployBackend = (projectId: string, epk: string) =>
  api.post<{ taskId: string; message: string }>(
      `/projects/${projectId}/deploy-ephemeral`,
      { ephemeralPubkey: epk },
  ).then(r => r.data);

/* 3 – wrapper: REST fallback polling */
export const getTaskStatus = (taskId: string) =>
  api.get<{ task: TaskEvent }>(`/tasks/${taskId}`).then(r => r.data.task);

export { streamTaskStatus }; 