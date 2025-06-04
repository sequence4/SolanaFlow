// naïve, in-memory token bucket – fine for the browser
const BURST = 5;           // Helius soft cap ﹤= 5 TPS
const REFILL_EVERY = 1000; // ms

let tokens = BURST;
setInterval(() => tokens = BURST, REFILL_EVERY);

export async function throttle(): Promise<void> {
  while (tokens <= 0) await new Promise(r => setTimeout(r, 50));
  --tokens;
} 