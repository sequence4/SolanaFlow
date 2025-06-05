// naïve, in-memory token bucket – fine for the browser
const BURST = 5;             // tokens per second
let tokens = BURST;
setInterval(() => tokens = BURST, 1_000);

export async function throttle(ms = 40): Promise<void> {
  if (ms) await new Promise(r => setTimeout(r, ms));      // soft wait
  while (tokens <= 0) await new Promise(r => setTimeout(r, 20));
  --tokens;
} 