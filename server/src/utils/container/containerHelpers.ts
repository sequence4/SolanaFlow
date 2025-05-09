import { execSync } from "child_process";

export async function isUrlAlive(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`URL check failed for ${url}:`, error);
    return false;
  }
}

export function extractContainerName(url: string) {
  return new URL(url).hostname;
}  

export async function folderExists(container: string, path: string): Promise<boolean> {
  try {
    execSync(`docker exec ${container} test -d ${path}`);
    return true;
  } catch {
    return false;
  }
}