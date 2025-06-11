import { Connection, Commitment } from "@solana/web3.js";

const BASE_DELAY = 250;          // ms
const MAX_DELAY  = 4_000;        // ms
const MAX_RETRY  = 5;            // ≈ 7¾ s total back-off

/**
 * Thin wrapper around Connection._rpcRequest that retries on HTTP 429
 * with exponential back-off.
 */
export async function rpcWithRetry<T = unknown>(
  conn: Connection,
  method: string,
  params: unknown[] = [],
  commitment: Commitment = "confirmed",
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      // _rpcRequest is still public in @solana/web3.js v1.9–1.17
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const res = await (conn as any)._rpcRequest(method, params, commitment);
      if (res?.error?.code === 429) throw new Error("429");
      return res.result as T;
    } catch (err: any) {
      if (err.message !== "429" || attempt === MAX_RETRY) throw err;
      const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      console.warn(`[RPC] 429 ⇒ retry #${attempt + 1} after ${delay} ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  // never reached
  throw new Error("unreachable");
} 