/* Centralised Docker client – imported everywhere else.
   It **neutralises DOCKER_HOST** so dockerode is forced to use the
   local UNIX socket, then re-exports the singleton.                  */

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import Docker from 'dockerode';

// 1️⃣  Remove misleading env vars _before_ constructing the client
delete process.env.DOCKER_HOST;
delete process.env.DOCKER_TLS_VERIFY;
delete process.env.DOCKER_CERT_PATH;

// 2️⃣  Build a single client that always hits the local socket
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  // Explicit protocol prevents dockerode from falling back to HTTP
  protocol: 'http+unix' as any,
});

export default docker; 