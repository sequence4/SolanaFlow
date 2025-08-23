"use client";
import { api } from "./apiHelper";
import { streamTaskStatus } from "./taskStream";
import { TaskEvent } from "./taskStream";

export const createEphemeralKey = (projectId: string): Promise<string> =>
  api
    .post<{ ephemeralPubkey: string; pubkey?: string }>(`/projects/${projectId}/ephemeral`)
    .then((r) => {
      const key = r.data.ephemeralPubkey || r.data.pubkey;
      if (!key) throw new Error("Server did not return a valid ephemeral public key");
      return key;
    });

export const getTaskStatus = (taskId: string) =>
  api.get<{ task: TaskEvent }>(`/tasks/${taskId}`).then(r => r.data.task);

export interface EphemeralDeployOptions {
  programId?: string;
  programData?: string;
  programArgs?: string[];
  programEnv?: Record<string, string>;
}

export const deployWithEphemeralKey = (projectId: string, epk: string, options: EphemeralDeployOptions) =>
  api.post<{ taskId: string; message: string }>(
      `/projects/${projectId}/deploy-ephemeral`,
      { ephemeralPubkey: epk, ...options },
  ).then(r => r.data);

export { streamTaskStatus }; 