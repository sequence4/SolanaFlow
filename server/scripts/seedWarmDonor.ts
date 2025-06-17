import * as dotenv from 'dotenv-flow';
dotenv.config();            // loads .env, .env.local, .env.$NODE_ENV …

import { execSync } from "child_process";
import { v4 as uuidv4 } from "uuid";
import pool from '../src/config/database';   // module-alias takes care of "@/…"

/**
 * Seeds ONE "warm" donor container:
 *   • random name  ('warm-<uuid>')
 *   • image tag    comes from env SOLANAFLOW_BUILD_IMAGE
 *   • port mapping host-random → 3000/tcp (-p 0:3000) so resolveContainerUrl works
 *   • label        solanaflow.pool=free   (picked by rentContainerFromPool)
 *   • DB row       busy=false, port = 0
 *
 * Run with:  pnpm seed:warm
 */
async function main() {
  const image =
    process.env.SOLANAFLOW_BUILD_IMAGE ??
    "ghcr.io/sequence4/solana-toolchain:runtime-latest";

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[seed] DATABASE_URL is undefined – aborting.");
    process.exit(1);
  }

  const name = `warm-${uuidv4()}`.slice(0, 63); // Docker name ≤ 63 chars
  console.log(`[seed] creating donor ${name} from ${image}`);

  // pull once so the command fails fast if the tag is wrong
  execSync(`docker pull --platform linux/arm64 ${image}`, { stdio: "inherit" });

  // run detached, map 3000 → random host-port
  execSync(
    [
      "docker run -d",
      "--platform linux/arm64",
      `--name ${name}`,
      '--label solanaflow.pool=free',
      "-p 0:3000", // <<< ★ key change – publish 3000/tcp
      image,
      "bash -lc 'sleep infinity'",
    ].join(" "),
    { stdio: "inherit" }
  );

  // insert (or upsert) pool row – port = 0 marks it as "clean / not used yet"
  await pool.query(
    `INSERT INTO warm_container_pool (name,image,busy,port,last_used)
         VALUES ($1,$2,false,0,now())
    ON CONFLICT (name) DO UPDATE
              SET image=$2, busy=false, port=0, last_used=now()`,
    [name, image]
  );

  console.log(`[seed] donor ${name} registered – ready for rent`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
}); 