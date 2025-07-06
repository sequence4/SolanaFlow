import { execSync } from "child_process";
import concat from "concat-stream";      // already in package.json
import docker from './dockerClient';
import * as tar from 'tar-stream';

const MAX_BUFFER = 128 * 1024 * 1024; // 128 MB – ample for artefact tar

/**
 * Reads a UTF-8 text file from a running container *without* spawning a shell.
 * @param containerName – the workspace container's name
 * @param containerPath – absolute path inside the container (e.g. /usr/src/…/foo.rs)
 */
export async function readFileFromContainer(
  containerName: string,
  filePath: string
): Promise<string> {
  const container = docker.getContainer(containerName);

  /* ------------------------------------------------------------------
   * 1) fast path – Docker API /getArchive (tar stream)
   * ------------------------------------------------------------------ */
  try {
    const stream = await container.getArchive({ path: filePath });
    const extract = tar.extract();

    return await new Promise<string>((resolve, reject) => {
      let contents = Buffer.alloc(0);

      extract.on("entry", (_hdr: any, entry: any, next: any) => {
        entry.pipe(
          concat((buf: Buffer) => {
            contents = Buffer.concat([contents, buf]);
            next();
          })
        );
      });

      extract.on("finish", () => resolve(contents.toString("utf8")));
      extract.on("error", reject);

      stream.pipe(extract);
    });
  } catch (err: any) {
    console.warn(
      `[readFileFromContainer] getArchive failed for ${filePath}:`,
      err?.message || err
    );
  }

  /* ------------------------------------------------------------------
   * 2) fallback – docker exec cat (never triggers docker-modem bug)
   * ------------------------------------------------------------------ */
  try {
    const safePath = filePath.replace(/'/g, "'\\''"); // bash-quote '
    return execSync(
      `docker exec ${containerName} bash -c "cat '${safePath}'"`,
      { encoding: "utf8", maxBuffer: MAX_BUFFER }
    );
  } catch (execErr) {
    throw new Error(
      `readFileFromContainer: both getArchive and exec fallback failed – ${execErr}`
    );
  }
} 