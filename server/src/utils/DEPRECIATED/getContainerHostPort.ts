import { runCommand } from "../command-execution/runCommand";

export async function getContainerHostPort(containerName: string, containerPort = 3000, taskId: string): Promise<string> {
  try {
    const portCmd = `docker port ${containerName} ${containerPort}/tcp`;
    // Get the port mapping which looks like "0.0.0.0:randomPort"
    const portMapping = await runCommand(portCmd, '.', taskId, { skipSuccessUpdate: true });
    const portMatch = portMapping.trim().match(/:(\d+)$/);
    
    if (!portMatch) {
      console.error(`Could not parse host port from Docker output: ${portMapping}`);
      throw new Error(`Failed to get host port for container ${containerName}`);
    }
    
    return portMatch[1]; // Return the port number as a string
  } catch (error: any) {
    console.error(`Error getting container host port: ${error.message}`);
    throw error;
  }
}