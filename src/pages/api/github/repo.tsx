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
  console.log("token", token.githubLinked);
  const gitToken = await db.account.findFirst({
    where: {
      userId: token.id,
      provider: "github",
    },
    select: {
      access_token: true,
    },
  });

  const repos = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `token ${gitToken?.access_token}`,
    },
  });
  const reposData = await repos.json();

  // console.log("reposData" , reposData)

  return res.redirect("/");
}
