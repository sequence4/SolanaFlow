export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-VRD2S5WGEZ";

export const isGaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NODE_ENV === 'production');

export function pageview(url: string) {
  if (!isGaEnabled) return;
  // @ts-expect-error gtag is injected by GA script at runtime – not present in typings
  window.gtag("event", "page_view", { page_path: url });
} 