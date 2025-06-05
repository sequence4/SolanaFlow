// naïve, in-memory token bucket – fine for the browser
const BURST = 5;           // Helius soft cap ﹤= 5 TPS
const REFILL_EVERY = 1000; // ms
const DEFAULT_WAIT = 40;   // ms (throttle guard)

let tokens = BURST;
setInterval(() => tokens = BURST, REFILL_EVERY);

export async function throttle(waitMs: number = DEFAULT_WAIT): Promise<void> {
  // Add optional wait to prevent sending too quickly
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  
  // Standard token bucket logic
  while (tokens <= 0) await new Promise(r => setTimeout(r, 50));
  --tokens;
} 