import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { randomBytes } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { publicKey } = req.body;
console.log("publicKey", publicKey);
  if (!publicKey || typeof publicKey !== "string") {
    return res.status(400).json({ error: "Missing or invalid publicKey" });
  }

  const nonce = randomBytes(16).toString("hex");

  await db.nonce.upsert({
    where: { publicKey },
    update: { nonce },
    create: { publicKey, nonce },
  });

  return res.status(200).json({ nonce });
}
