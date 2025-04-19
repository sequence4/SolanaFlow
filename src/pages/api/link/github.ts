import { db } from "~/server/db";
import { getToken } from "next-auth/jwt";
import type { NextApiRequest, NextApiResponse } from "next";

const secret = process.env.AUTH_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await getToken({ req: req as unknown as Request, secret });
  if (!token?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Get the GitHub OAuth code from the request
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing GitHub code" });
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GITHUB_ID!,
      client_secret: process.env.AUTH_GITHUB_SECRET!,
      code: code as string,
    }),
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return res.status(400).json({ error: "Invalid GitHub token exchange" });
  }

  // Get the user's GitHub profile
  const githubProfile = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  }).then((r) => r.json());
  if (typeof token.id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }
  // Save GitHub account to current user
  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "github",
        providerAccountId: githubProfile.id.toString(),
      },
    },
    update: {
      access_token: accessToken,
    },
    create: {
      userId: token.id,
      provider: "github",
      providerAccountId: githubProfile.id.toString(),
      type: "oauth",
      access_token: accessToken,
    },
  });

  return res.redirect("/login?githubLinked=true");
}
