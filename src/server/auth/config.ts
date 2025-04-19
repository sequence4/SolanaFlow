import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { SigninMessage } from "~/utils/SigninMessage";
import { getCsrfToken } from "next-auth/react";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      githubLinked?: boolean;
      publicKey?: string;
      // Add other properties here
      // For example, if you have a role property:
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    //DiscordProvider,
    GitHubProvider({
      authorization: {
        params: {
          scope: "read:user repo", // this allows access to private repos too
        },
      },
    }),
    CredentialsProvider({
      name: "Solana",
      credentials: {
        message: {
          label: "Message",
          type: "text",
        },
        signature: {
          label: "Signature",
          type: "text",
        },
      },
      authorize: async (credentials, req) => {
        try {
          const message = JSON.parse(
            typeof credentials?.message === "string"
              ? credentials?.message
              : "{}",
          );
          const signinMessage = new SigninMessage(message);

          const nextAuthUrlString = process.env.NEXTAUTH_URL;
          if (!nextAuthUrlString)
            throw new Error("NEXTAUTH_URL is not defined");
          const nextAuthUrl = new URL(nextAuthUrlString);

          if (signinMessage.getDomain() !== nextAuthUrl.host) return null;

          const publicKey = signinMessage.getPublicKey();
          const expectedNonce = await db.nonce.findUnique({
            where: { publicKey },
          });

          if (expectedNonce?.nonce !== signinMessage.getNonce()) {
            return null;
          }

          const isValid = await signinMessage.validate(
            typeof credentials?.signature === "string"
              ? credentials.signature
              : "",
          );

          if (!isValid) {
            console.error("Invalid signature");
            return null;
          }

          // Optionally: get username from nonce table or you can pass it another way
          const userRecord = await db.user.upsert({
            where: { publicKey },
            update: {},
            create: {
              publicKey,
              name: message.username || "Anonymous", // Or pull from the db if stored earlier
            },
          });
          // console.log("User record:", userRecord);
          return userRecord;
        } catch (err) {
          console.error("Authorization error:", err);
          return null;
        }
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: PrismaAdapter(db),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update") {
        console.log("Session update triggered", session)

        // You can update the token based on the session data passed to update()
        if (session?.updateGithubStatus) {
          // Fetch the latest user data from the database
          const userFromDB = await db.user.findUnique({
            where: { id: token.id as string },
            include: { accounts: true },
          })

          // Update the token with fresh data
          token.githubLinked = userFromDB?.accounts.some((acc) => acc.provider === "github")

          // You can add additional data to the token here
          token.lastUpdated = new Date().toISOString()
        }

        return token
      }
      
      if (user) {
        token.id = user.id;

        // Only fetch once on login
        const userFromDB = await db.user.findUnique({
          where: { id: user.id },
          include: { accounts: true },
        });

        token.name = userFromDB?.name;
        token.image = userFromDB?.image;
        token.publicKey = userFromDB?.publicKey;

        token.githubLinked = userFromDB?.accounts.some(
          (acc) => acc.provider === "github",
        );
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
        session.user.publicKey = token.publicKey as string;
        session.user.githubLinked = token.githubLinked as boolean;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
