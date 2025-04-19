import { getToken } from "next-auth/jwt";
import type { NextApiRequest, NextApiResponse } from "next";

const secret = process.env.AUTH_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await getToken({ req: req as unknown as Request, secret });

  if (!token?.sub) {
    return res.status(401).json({
      error: "You must be signed in with your Solana Wallet to view this content.",
    });
  }

  res.status(200).json({
    message: "You're authenticated 🎉",
    wallet: token.sub,
    name: token.name,
  });
}
