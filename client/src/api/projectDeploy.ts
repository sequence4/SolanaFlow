"use client";
import { api } from "./apiHelper";
import { streamTaskStatus } from "./taskStream";
import { TaskEvent } from "./taskStream";

/* 1 – wrapper: create an ephemeral key (already exists via projectApi) */
// Request an ephemeral authority key and return its base‑58 string
export const createEphemeralKey = (projectId: string): Promise<string> =>
  api
    .post<{ ephemeralPubkey: string; pubkey?: string }>(`/projects/${projectId}/ephemeral`)
    .then((r) => {
      const key = r.data.ephemeralPubkey || r.data.pubkey;
      if (!key) throw new Error("Server did not return a valid ephemeral public key");
      return key;
    });

/* 2 – wrapper: tell backend which pubkey it should later sign with.
      Server route is POST /projects/:id/ephemeral and returns { status: 'ok' } */
export const deployBackend = (projectId: string, pubkey: string) => {
  const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';
  if (DEBUG_LOGS) console.log('[deployBackend] Using pubkey:', pubkey);
  
  return api.post<{ status: string }>(
    `/projects/${projectId}/ephemeral`,
    { pubkey },                           // server expects `pubkey`
  ).then(r => {
    if (DEBUG_LOGS) console.log('[deployBackend] Response:', r.data);
    return r.data;
  });
};

/* 3 – wrapper: REST fallback polling */
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