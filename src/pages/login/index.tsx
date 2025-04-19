"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { signIn, signOut, useSession, getSession } from "next-auth/react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SigninMessage } from "~/utils/SigninMessage";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Network, Loader2, Link } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import NextLink from "next/link";
import { useRouter } from "next/router";

export default function LoginPage() {
  const { data: session, status, update } = useSession(); // getSession() TO refresh instead of call it will use the database not efficient
  const loading = status === "loading";
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailSigningIn, setIsEmailSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState("wallet");
  const GITHUB_CLIENT_ID = "Iv23liQTAct9QdexWdmV"; // very important to keep this secret im just lazy
  const router = useRouter();
  const { githubLinked } = router.query;

  const redirectToGitHub = () => {
    const githubOAuthURL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user repo&redirect_uri=http://localhost:3000/api/link/github`;
    window.location.href = githubOAuthURL;
  };
  const disconnectWallet = async () => {
    wallet.disconnect();
  };

  const handleWalletSignIn = async () => {
    try {
      setIsSigningIn(true);

      if (!wallet.connected) {
        walletModal.setVisible(true);
        setIsSigningIn(false);
        return;
      }

      const response = await fetch("/api/solana/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: wallet.publicKey?.toBase58(),
        }),
      });

      const { nonce } = await response.json();
      if (!wallet.publicKey || !nonce || !wallet.signMessage) {
        setIsSigningIn(false);
        return;
      }

      const message = new SigninMessage({
        domain: window.location.host,
        publicKey: wallet.publicKey?.toBase58(),
        statement: `Sign this message to sign in to the app.`,
        nonce: nonce,
        username: username, // Make username optional
      });

      const data = new TextEncoder().encode(message.prepare());
      const signature = await wallet.signMessage(data);
      const serializedSignature = bs58.encode(signature);

      await signIn("credentials", {
        message: JSON.stringify(message),
        signature: serializedSignature,
        redirect: false,
      });

      setIsSigningIn(false);
    } catch (error) {
      console.error(error);
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const refreshSession = async () => {
      try {
        await update({
          updateGithubStatus: true,
        });
        console.log("Session refreshed", await update({
          updateGithubStatus: true,
        }));
      } catch (error) {
        console.error("Failed to refresh session:", error);
      }
    };
    if (githubLinked) {
      console.log("TRYING Github linked:");
      refreshSession();
    }
  }, [githubLinked]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-500">
          <Image 
                src="/logo.png" 
                alt="Solana FlowCode" 
                width={40} 
                height={40} 
                className="rounded-md" 
              />
          </div>
          <h1 className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-2xl font-bold text-transparent">
            NexusAI
          </h1>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            <p className="text-gray-400">Loading your session...</p>
          </div>
        </div>
      </div>
    );
  }

  // Already signed in
  if (session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-blue-500">
            <Image 
                          src="/logo.png" 
                          alt="Solana FlowCode" 
                          width={40} 
                          height={40} 
                          className="rounded-md" 
                        />
          </div>
          <h1 className="text-3xl font-bold">Welcome to NexusAI</h1>
          <p className="text-gray-400">You're successfully signed in!</p>
          <div className="mt-4 flex flex-col justify-center gap-4">
            <NextLink
              href="/dashboard"
              className="rounded-sm bg-gray-700 p-2 hover:bg-gray-800"
            >
              Go Dashboard
            </NextLink>
            {session.user.githubLinked ? (
              <>
                {" "}
                <Button
                  disabled
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                >
                 Github Linked {session.user.name}
                </Button>
              
              </>
            ) : (
              <>
                <Button
                  onClick={() => redirectToGitHub()}
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                >
                  Link Github
                </Button>
               
              </>
            )}
             <Button
                  onClick={() => signOut({ redirect: false })}
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                >
                  Sign Out
                </Button>{" "}
          </div>
        </div>
      </div>
    );
  }

  // Login page
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(67,56,202,0.15),rgba(0,0,0,0))]"></div>

      <nav className="relative z-10 container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-500">
            <Network className="h-6 w-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-xl font-bold text-transparent">
            NexusAI
          </span>
        </div>
      </nav>

      <div className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center">
        <Card className="w-[350px] border-gray-800 bg-gray-900/70">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-gray-400">
              Sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-1 bg-gray-800">
                <TabsTrigger
                  value="wallet"
                  className="data-[state=active]:bg-gray-700"
                >
                  Wallet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="wallet" className="mt-4 space-y-4">
                {!wallet.connected ? (
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={() => walletModal.setVisible(true)}
                  >
                    Connect Wallet
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-md bg-gray-800 p-3">
                      <span className="text-sm text-gray-300">Connected:</span>
                      <span className="font-mono text-sm">
                        {wallet.publicKey?.toBase58().slice(0, 4)}...
                        {wallet.publicKey?.toBase58().slice(-4)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-gray-300">
                        Username
                      </Label>
                      <Input
                        id="username"
                        className="border-gray-700 bg-gray-800"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        onClick={handleWalletSignIn}
                        disabled={isSigningIn}
                      >
                        {isSigningIn ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing In
                          </>
                        ) : (
                          <>Sign In</>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        className="border-gray-700 hover:bg-gray-800"
                        onClick={disconnectWallet}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400">
              Don't have an account?{" "}
              <a href="/register" className="text-blue-400 hover:underline">
                Sign up
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
