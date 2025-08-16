/**
 * Base URL for backend API calls.
 *
 * Priority:
 *   1. NEXT_PUBLIC_API_URL  → honour if the user sets it
 *   2. In-browser           → ''  (same-origin)
 *   3. SSR / Node scripts   → http://localhost:3000  (dev default)
 */

const fromEnv = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")   // trim trailing /
  : undefined;

let fallback = "";
if (typeof window === "undefined") {
  // running under Node (e.g. getServerSideProps, tests)
  fallback = "http://localhost:3000";
}

export const API_URL = fromEnv || fallback; 