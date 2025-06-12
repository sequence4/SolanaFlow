import Docker, { DockerOptions } from 'dockerode';
import * as tar from 'tar-stream';
import { finished } from 'stream/promises';

/**
 * One global Docker client that **always** talks to the local daemon.
 *  – `socketPath` ignores any `DOCKER_HOST` env that might be set
 *    (which is what triggered the EAI_AGAIN 'solanaflow-demo' DNS failure). 
 *  – Keep it singleton-style so we don't open a new socket per file.
 */
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
} as DockerOptions);

/**
 * Reads a UTF-8 text file from a running container *without* spawning a shell.
 * @param containerName – the workspace container's name
 * @param containerPath – absolute path inside the container (e.g. /usr/src/…/foo.rs)
 */
export async function readFileFromContainer(
  containerName: string,
  containerPath: string
): Promise<string> {
  const container = docker.getContainer(containerName);
  const tStream   = await container.getArchive({ path: containerPath }); // tar stream

  const extract = tar.extract();
  let fileContent = '';
  extract.on('entry', (header: any, stream: any, next: any) => {
    if (header.type !== 'file') {         // skip dirs, pax headers
      stream.resume(); return next();
    }
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => {
      fileContent = Buffer.concat(chunks).toString('utf8');
      next();                             // continue (usually no more entries)
    });
  });

  tStream.pipe(extract);
  await finished(extract);
  return fileContent;
} 