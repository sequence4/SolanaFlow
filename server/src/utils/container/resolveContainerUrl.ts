import { execSync } from 'child_process';

export async function resolveContainerUrl(containerName: string): Promise<string> {
    try {
      const portMapping = execSync(`docker port ${containerName} 3000/tcp`).toString().trim();
      const portMatch = portMapping.match(/:(\d+)$/);
      
      if (!portMatch) {
        throw new Error(`Failed to parse port mapping from: ${portMapping}`);
      }
      
      const port = portMatch[1];
      const host = process.env.NODE_ENV === 'production' 
        ? process.env.DOCKER_HOST || 'localhost'
        : 'localhost';
      
      return `http://${host}:${port}`;
    } catch (error) {
      console.error(`Failed to resolve container URL for ${containerName}:`, error);
      throw new Error(`Failed to resolve container URL: ${error}`);
    }
  }