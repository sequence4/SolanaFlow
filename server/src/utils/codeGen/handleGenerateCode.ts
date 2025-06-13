import { refreshWorkspaceTree } from './refreshWorkspaceTree';
//import { genUi } from './genUi';
import { Graph } from '../../types/graph';
import type { WorkspaceHandle } from '../deploy/prepEnv';
import { amendConfigFiles } from './amendConfigFiles';
import { pollTaskStatus, createTask, updateTaskStatus } from '../taskUtils';
import { genSrcFiles } from './genSrcFiles';
import { insertSrcFiles } from './insertSrcFiles';
import { debugDumpContainerTree, debugPrintFiles } from '../containerUtils';
import { ensureAnchorTomlProgram, ensureRootWorkspaceMembers } from './ensureConfigHelpers';
import { parseNodeDetails } from './parseNodeDetails';
import { lintWorkspaceManifests } from './cargoManifestLint';
import { FileTreeItem } from '../../types/FileTreeItem';

/** Block until every task-id is in a final state. */
async function waitForAll(taskIds: string[]): Promise<{
  succeeded: string[];
  failed: string[];
}> {
  const finals = ['succeed', 'finished', 'failed', 'warning'];
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const id of taskIds) {
    if (!id) continue;
    try {
      const { task } = await pollTaskStatus(id);
      (task.status === 'succeed' || task.status === 'finished'
        ? succeeded
        : failed
      ).push(id);
    } catch (err) {
      console.error(`[GEN] pollTaskStatus error for ${id}:`, err);
      failed.push(id);
    }
  }
  return { succeeded, failed };
}

interface Args {
  projectId: string;
  graph: Graph;
  workspace: WorkspaceHandle;
  sendProgress: (data: unknown) => void;
  userId: string;
}

export const handleGenerateCode = async ({
  projectId,
  graph,
  workspace,
  sendProgress,
  userId,
}: Args): Promise<void> => {   
    console.log('[GEN] projectId   =', projectId);
    console.log('[GEN] userId      =', userId);
    console.log('[GEN] workspace   =', workspace);
    console.log('[GEN] nodes.len   =', graph.nodes.length);
    //console.log('[GEN] first node  =', graph.nodes[0]);
    
    try {
        if (graph.nodes.length === 0) throw new Error('No nodes found');
        let functionCode = null;

        // ───────────────── collect code blocks ───────────────────────────
        const functionParts = graph.nodes
          .map(n => {
            const maybeCode =
              // new schema
              (n as any).config?.code ??
              // old/basic schema
              (n as any).data?.code ??
              null;

            return typeof maybeCode === 'string' ? maybeCode : null;
          })
          .filter(Boolean) as string[];

        // Find instructions for debugPrintFiles - this is a simplified assumption
        // A more robust approach would be to get this from parsed node details like in genSrcFiles.ts
        const instructions = graph.nodes.map(n => ({ name: ((n as any).data)?.label?.replace(/\s+/g, '').toLowerCase() || 'unknown' })).filter(i => i.name !== 'unknown');

        console.log('[GEN] raw snippet count =', functionParts.length);
        if (functionParts.length) {
            //console.log('[GEN] first 200 chars of combined code:\n',
            //    functionParts.join('\n\n').slice(0, 200));
        }

        if (functionParts.length > 0) functionCode = functionParts.join('\n\n');
        else console.log('No valid function code found in nodes');

        console.log('DEBUG handleGenerateCode functionCode:', functionCode);

        //const frontendTaskId = await genUi(nodes);   // possible skip this step if not working correctly (save til end) 
        
        sendProgress({ stage: 'file-tree', message: 'Refreshing file tree…' });
        const fileTreeTaskIds = await refreshWorkspaceTree(projectId, userId);
        console.log('[GEN] refreshWorkspaceTree triggered, taskIds =', fileTreeTaskIds);
        sendProgress({ stage: 'file-tree', message: 'Waiting for file-tree refresh…' });

        const { succeeded, failed } = await waitForAll(fileTreeTaskIds);

        console.log('[GEN] file-tree tasks done → ok:', succeeded, 'fail:', failed);
        sendProgress({
          stage: failed.length ? 'file-tree-failed' : 'file-tree-done',
          message: failed.length
            ? `File-tree refresh: ${failed.length} task(s) failed`
            : 'File-tree refresh complete'
        });

        if (failed.length) {
          throw new Error(`File-tree task(s) failed: ${failed.join(', ')}`);
        }

        // ───────────────────────── write graph-derived Rust sources ──────────────
        // 1) get the file tree result to check for existing program directory
        const treeTaskId = fileTreeTaskIds[0];
        const treeResult = await pollTaskStatus(treeTaskId);
        const initialTree = JSON.parse(treeResult.task.result ?? '[]');
        
        // 2) for now, assume a basic program structure exists or will be created
        // TODO: implement findProgramsDirectory and initAnchorProject when available
        const programName = 'my_program'; // TODO: derive from project context
        const programId = '11111111111111111111111111111111'; // TODO: fetch real ID
        
        // Call ensure config helpers BEFORE refreshing the tree
        await ensureAnchorTomlProgram(
          workspace,
          programName,
          programId,
          projectId,
          /* creatorId */ null
        );

        await ensureRootWorkspaceMembers(
          workspace,
          projectId,
          /* creatorId */ null
        );

        // 3) build in-memory src/ tree
        const projectState = { nodes: graph.nodes, edges: graph.edges || [] };
        const srcTree = genSrcFiles(projectState, programName, programId);
        if (!srcTree) throw new Error('genSrcFiles returned null');
        
        // Parse details again to get canonical instruction names for debug logging
        const { instructions: canonicalInstructions, state: canonicalState } = parseNodeDetails(projectState);
        // The canonicalization of inst.name based on fnMatch happens *inside* genSrcFiles
        // and also inside parseNodeDetails if we were to enhance it.
        // For now, assume parseNodeDetails provides the names needed for paths,
        // and genSrcFiles internally uses the fnMatch for generation.
        // To be perfectly correct, we might need genSrcFiles to return canonicalInstructions
        // or re-run the fnMatch logic here. For debugPrintFiles, this should be sufficient.

        /* --------------------------------------------------------------- *
         * 4 ─ write the src tree into the workspace
         * --------------------------------------------------------------- */
        sendProgress({ stage: 'src-gen', message: 'Generating Rust sources…' });
        console.log('[GEN] Generated src tree:', JSON.stringify(srcTree, null, 2));

        // Gather existing paths so insertSrcFiles can decide create vs update
        const existing = new Set(flattenPaths(initialTree));
        const writeTaskIds = await insertSrcFiles(
          srcTree,
          projectId,
          existing,
          /* creatorId */ null
        );

        console.log('[GEN] insertSrcFiles returned taskIds =', writeTaskIds);

        if (writeTaskIds.length) {
          sendProgress({ stage: 'src-write', message: 'Writing Rust files…' });
          const { succeeded, failed } = await waitForAll(writeTaskIds);
          console.log('[GEN] src-write tasks done → ok:', succeeded, 'fail:', failed);

          if (failed.length) {
            sendProgress({
              stage: 'src-write-failed',
              message: `Rust write: ${failed.length} task(s) failed`,
            });
            throw new Error(`insertSrcFiles failed for ${failed.join(', ')}`);
          }
        } else {
          console.log('[GEN] insertSrcFiles produced no work (tree empty?)');
        }

        sendProgress({ stage: 'src-gen-done', message: 'Rust sources ready' });

        /* --------------------------------------------------------------- *
         * 5 ─ inject token-minting UI into Next.js app
         * --------------------------------------------------------------- */
        sendProgress({ stage: 'ui-gen', message: 'Generating token-minting UI…' });

        // UI Templates - in production these would be imported from a separate file
        const HOME_PAGE_TSX = `"use client";

        import { useState } from "react";
        import MintForm from "../src/components/mint-form";
        import TokenCreatedSuccess from "../src/components/token-created-success";
        import ThemeToggle from "../src/components/theme-toggle";
        import Wallet from "../src/components/wallet";

        export default function Home() {
          const [txSignature, setTxSignature] = useState<string | null>(null);

          const handleMintSuccess = (signature: string) => {
            setTxSignature(signature);
          };

          const handleCreateAnother = () => {
            setTxSignature(null);
          };

          return (
            <main className="flex min-h-screen flex-col items-center p-6 md:p-24 gap-8">
              <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
                <h1 className="text-xl font-bold">SolMint</h1>
                <div className="flex items-center gap-4">
                  <ThemeToggle />
                  <Wallet />
                </div>
              </div>

              <div className="w-full max-w-2xl">
                {txSignature ? (
                  <TokenCreatedSuccess 
                    signature={txSignature}
                    onCreateAnother={handleCreateAnother} 
                  />
                ) : (
                  <MintForm onSuccess={handleMintSuccess} />
                )}
              </div>
            </main>
          );
        }`;

        const LAYOUT_TSX = `"use client";

        import "../src/globals.css";
        import { WalletConnectionProvider } from "../src/context/WalletConnectionProvider";

        export default function RootLayout({ children }: { children: React.ReactNode }) {
          return (
            <html lang="en" className="light" suppressHydrationWarning>
              <body className="min-h-screen bg-background font-sans antialiased">
                <WalletConnectionProvider>
                  {children}
                </WalletConnectionProvider>
              </body>
            </html>
          );
        }`;

        const WALLET_CONNECTION_PROVIDER_TSX = `"use client";

        import { FC, ReactNode, useMemo } from "react";
        import {
          ConnectionProvider,
          WalletProvider,
        } from "@solana/wallet-adapter-react";
        import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
        import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
        import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

        // Import wallet adapter styles
        import "@solana/wallet-adapter-react-ui/styles.css";

        const WalletConnectionProvider: FC<{ children: ReactNode }> = ({ children }) => {
          // Use Devnet cluster for development
          const network = WalletAdapterNetwork.Devnet;

          // RPC endpoint for Devnet
          const endpoint = "https://api.devnet.solana.com";

          // Initialize supported wallets (currently only Phantom)
          const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

          return (
            <ConnectionProvider endpoint={endpoint}>
              <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          );
        };

        export { WalletConnectionProvider };`;

        const MINT_FORM_TSX = `"use client";

        import { useState } from "react";
        import { Button } from "./ui/button";
        import { Input } from "./ui/input";
        import { Label } from "./ui/label";
        import { useWallet } from "@solana/wallet-adapter-react";

        interface MintFormProps {
          onSuccess: (signature: string) => void;
        }

        export default function MintForm({ onSuccess }: MintFormProps) {
          const { connected, publicKey } = useWallet();
          const [loading, setLoading] = useState(false);
          const [formData, setFormData] = useState({
            tokenName: "",
            tokenSymbol: "",
            decimals: "9",
            mintAuthority: "",
          });

          const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setFormData({ ...formData, [name]: value });
          };

          const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            
            if (!connected || !publicKey) {
              alert("Please connect your wallet first");
              return;
            }
            
            setLoading(true);
            
            try {
              // In a real implementation, this would call the backend API or
              // use the IDL to create a transaction that calls the on-chain program
              console.log("Creating token with:", formData);
              
              // Simulate transaction delay
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Simulate a successful transaction
              const mockSignature = "5FG9UDfZ69UEUzpzMgZy2XMtEAFRrv41U7cTwGsGYHFED7YPbXHdwfDDSj2kotdV3NQPYzXsjD7mRBRuhFaorw6B";
              onSuccess(mockSignature);
            } catch (error) {
              console.error("Error creating token:", error);
              alert("Failed to create token. See console for details.");
            } finally {
              setLoading(false);
            }
          };

          return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex flex-col space-y-1.5 pb-6">
                <h3 className="text-2xl font-semibold leading-none tracking-tight">Create a Token</h3>
                <p className="text-sm text-muted-foreground">
                  Fill out this form to mint a new SPL token on Solana
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token Name</Label>
                  <Input
                    id="tokenName"
                    name="tokenName"
                    placeholder="My Token"
                    required
                    value={formData.tokenName}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tokenSymbol">Token Symbol</Label>
                  <Input
                    id="tokenSymbol"
                    name="tokenSymbol"
                    placeholder="MTK"
                    required
                    maxLength={10}
                    value={formData.tokenSymbol}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="decimals">Decimals</Label>
                  <Input
                    id="decimals"
                    name="decimals"
                    type="number"
                    min="0"
                    max="9"
                    placeholder="9"
                    value={formData.decimals}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of decimal places (0-9, default is 9)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mintAuthority">Mint Authority (optional)</Label>
                  <Input
                    id="mintAuthority"
                    name="mintAuthority"
                    placeholder="Leave blank to use connected wallet"
                    value={formData.mintAuthority}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Public key with permission to mint new tokens
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full mt-6" 
                  disabled={!connected || loading}
                >
                  {loading ? "Creating..." : "Create Token"}
                </Button>
              </form>
            </div>
          );
        }`;

        const TOKEN_CREATED_SUCCESS_TSX = `"use client";

        import { Button } from "./ui/button";

        interface TokenCreatedSuccessProps {
          signature: string;
          onCreateAnother: () => void;
        }

        export default function TokenCreatedSuccess({
          signature,
          onCreateAnother,
        }: TokenCreatedSuccessProps) {
          // Shorten signature for display
          const shortSignature = 
            signature.substring(0, 8) + '...' + signature.substring(signature.length - 8);
          
          // Create Solana Explorer link
          const explorerUrl = \`https://explorer.solana.com/tx/\${signature}?cluster=devnet\`;

          return (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-6">
              <div className="flex flex-col space-y-1.5">
                <h3 className="text-2xl font-semibold leading-none tracking-tight">
                  Token Created Successfully!
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your SPL token has been created on Devnet.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Transaction Signature:</p>
                  <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                    {shortSignature}
                  </code>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => window.open(explorerUrl, '_blank')}
                  >
                    View on Explorer
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onCreateAnother}
                  >
                    Create Another Token
                  </Button>
                </div>
              </div>
            </div>
          );
        }`;

        const THEME_TOGGLE_TSX = `"use client";

        import { useState, useEffect } from "react";
        import { Button } from "./ui/button";
        import { Moon, Sun } from "lucide-react";

        export default function ThemeToggle() {
          const [theme, setTheme] = useState<"light" | "dark">("light");
          
          // Apply theme class to html element
          const applyTheme = (newTheme: "light" | "dark") => {
            const root = document.documentElement;
            
            if (newTheme === "dark") {
              root.classList.add("dark");
            } else {
              root.classList.remove("dark");
            }
          };
          
          // Toggle between light and dark themes
          const toggleTheme = () => {
            const newTheme = theme === "light" ? "dark" : "light";
            setTheme(newTheme);
            localStorage.setItem("theme", newTheme);
            applyTheme(newTheme);
          };
          
          // Initialize theme on component mount
          useEffect(() => {
            // Check localStorage or system preference
            const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            
            const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
            setTheme(initialTheme);
            applyTheme(initialTheme);
          }, []);

          return (
            <Button
              variant="ghost" 
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          );
        }`;

        const WALLET_TSX = `"use client";

        import { Button } from "./ui/button";
        import { useWallet } from "@solana/wallet-adapter-react";
        import { useWalletModal } from "@solana/wallet-adapter-react-ui";

        export default function Wallet() {
          const { publicKey, connected, disconnect } = useWallet();
          const { setVisible } = useWalletModal();
          
          // Format public key for display
          const displayAddress = publicKey 
            ? publicKey.toString().slice(0, 4) + ".." + publicKey.toString().slice(-4) 
            : "";

          const handleConnect = () => {
            setVisible(true);
          };

          return (
            <Button
              variant={connected ? "outline" : "default"}
              onClick={connected ? disconnect : handleConnect}
            >
              {connected ? \`\${displayAddress} ✓\` : "Connect Wallet"}
            </Button>
          );
        }`;

        const BUTTON_TSX = `"use client";

        import * as React from "react";
        import { cn } from "../lib/utils";

        const buttonVariants = {
          default: "bg-primary text-primary-foreground hover:bg-primary/90",
          destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          outline: "border border-input hover:bg-accent hover:text-accent-foreground",
          secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost: "hover:bg-accent hover:text-accent-foreground",
          link: "underline-offset-4 hover:underline text-primary",
        };

        const buttonSizes = {
          default: "h-10 py-2 px-4",
          sm: "h-9 px-3 rounded-md",
          lg: "h-11 px-8 rounded-md",
          icon: "h-10 w-10",
        };

        export interface ButtonProps
          extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          variant?: keyof typeof buttonVariants;
          size?: keyof typeof buttonSizes;
        }

        const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
          ({ className, variant = "default", size = "default", ...props }, ref) => {
            return (
              <button
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  buttonVariants[variant],
                  buttonSizes[size],
                  className
                )}
                ref={ref}
                {...props}
              />
            );
          }
        );
        Button.displayName = "Button";

        export { Button, buttonVariants };`;

        const INPUT_TSX = `"use client";

        import * as React from "react";
        import { cn } from "../lib/utils";

        export interface InputProps
          extends React.InputHTMLAttributes<HTMLInputElement> {}

        const Input = React.forwardRef<HTMLInputElement, InputProps>(
          ({ className, type, ...props }, ref) => {
            return (
              <input
                type={type}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  className
                )}
                ref={ref}
                {...props}
              />
            );
          }
        );
        Input.displayName = "Input";

        export { Input };`;

        const LABEL_TSX = `"use client";

        import * as React from "react";
        import * as LabelPrimitive from "@radix-ui/react-label";
        import { cn } from "../lib/utils";

        const Label = React.forwardRef<
          React.ElementRef<typeof LabelPrimitive.Root>,
          React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
        >(({ className, ...props }, ref) => (
          <LabelPrimitive.Root
            ref={ref}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              className
            )}
            {...props}
          />
        ));
        Label.displayName = LabelPrimitive.Root.displayName;

        export { Label };`;

        const UTILS_TS = `import { clsx, type ClassValue } from 'clsx';
        import { twMerge } from 'tailwind-merge';

        export function cn(...inputs: ClassValue[]) {
          return twMerge(clsx(inputs));
        }`;

        const GLOBALS_CSS = `@tailwind base;
        @tailwind components;
        @tailwind utilities;

        @layer base {
          :root {
            --background: 0 0% 100%;
            --foreground: 222.2 47.4% 11.2%;
            --muted: 210 40% 96.1%;
            --muted-foreground: 215.4 16.3% 46.9%;
            --popover: 0 0% 100%;
            --popover-foreground: 222.2 47.4% 11.2%;
            --card: 0 0% 100%;
            --card-foreground: 222.2 47.4% 11.2%;
            --border: 214.3 31.8% 91.4%;
            --input: 214.3 31.8% 91.4%;
            --primary: 222.2 47.4% 11.2%;
            --primary-foreground: 210 40% 98%;
            --secondary: 210 40% 96.1%;
            --secondary-foreground: 222.2 47.4% 11.2%;
            --accent: 210 40% 96.1%;
            --accent-foreground: 222.2 47.4% 11.2%;
            --destructive: 0 100% 50%;
            --destructive-foreground: 210 40% 98%;
            --ring: 215 20.2% 65.1%;
            --radius: 0.5rem;
          }
         
          .dark {
            --background: 224 71% 4%;
            --foreground: 213 31% 91%;
            --muted: 223 47% 11%;
            --muted-foreground: 215.4 16.3% 56.9%;
            --popover: 224 71% 4%;
            --popover-foreground: 215 20.2% 65.1%;
            --card: 224 71% 4%;
            --card-foreground: 213 31% 91%;
            --border: 216 34% 17%;
            --input: 216 34% 17%;
            --primary: 210 40% 98%;
            --primary-foreground: 222.2 47.4% 1.2%;
            --secondary: 222.2 47.4% 11.2%;
            --secondary-foreground: 210 40% 98%;
            --accent: 216 34% 17%;
            --accent-foreground: 210 40% 98%;
            --destructive: 0 63% 31%;
            --destructive-foreground: 210 40% 98%;
            --ring: 216 34% 17%;
          }
        }

        @layer base {
          * {
            @apply border-border;
          }
          body {
            @apply bg-background text-foreground;
          }
        }`;

        const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
        module.exports = {
          darkMode: ["class"],
          content: [
            './app/**/*.{js,ts,jsx,tsx}',
            './src/**/*.{js,ts,jsx,tsx}',
            './components/**/*.{js,ts,jsx,tsx}'
          ],
          theme: {
            extend: {
              colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                  DEFAULT: "hsl(var(--primary))",
                  foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                  DEFAULT: "hsl(var(--secondary))",
                  foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                  DEFAULT: "hsl(var(--destructive))",
                  foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                  DEFAULT: "hsl(var(--muted))",
                  foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                  DEFAULT: "hsl(var(--accent))",
                  foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                  DEFAULT: "hsl(var(--popover))",
                  foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                  DEFAULT: "hsl(var(--card))",
                  foreground: "hsl(var(--card-foreground))",
                },
              },
              borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 0.2rem)",
                sm: "calc(var(--radius) - 0.4rem)",
              },
            },
          },
          plugins: [],
        }`;

        const POSTCSS_CONFIG = `module.exports = {
          plugins: {
            tailwindcss: {},
            autoprefixer: {},
          }
        }`;

        // Build the UI file tree
        const uiFiles = {
          name: ".",
          path: ".",
          type: "directory" as const,
          children: [
            {
              name: "app",
              path: "./app",
              type: "directory" as const,
              children: [
                { name: "page.tsx", path: "./app/page.tsx", type: "file" as const, code: HOME_PAGE_TSX },
                { name: "layout.tsx", path: "./app/layout.tsx", type: "file" as const, code: LAYOUT_TSX }
              ]
            },
            {
              name: "src",
              path: "./src",
              type: "directory" as const,
              children: [
                {
                  name: "components",
                  path: "./src/components",
                  type: "directory" as const,
                  children: [
                    { name: "mint-form.tsx", path: "./src/components/mint-form.tsx", type: "file" as const, code: MINT_FORM_TSX },
                    { name: "token-created-success.tsx", path: "./src/components/token-created-success.tsx", type: "file" as const, code: TOKEN_CREATED_SUCCESS_TSX },
                    { name: "theme-toggle.tsx", path: "./src/components/theme-toggle.tsx", type: "file" as const, code: THEME_TOGGLE_TSX },
                    { name: "wallet.tsx", path: "./src/components/wallet.tsx", type: "file" as const, code: WALLET_TSX },
                    {
                      name: "ui",
                      path: "./src/components/ui",
                      type: "directory" as const,
                      children: [
                        { name: "button.tsx", path: "./src/components/ui/button.tsx", type: "file" as const, code: BUTTON_TSX },
                        { name: "input.tsx", path: "./src/components/ui/input.tsx", type: "file" as const, code: INPUT_TSX },
                        { name: "label.tsx", path: "./src/components/ui/label.tsx", type: "file" as const, code: LABEL_TSX }
                      ]
                    }
                  ]
                },
                {
                  name: "context",
                  path: "./src/context",
                  type: "directory" as const,
                  children: [
                    { name: "WalletConnectionProvider.tsx", path: "./src/context/WalletConnectionProvider.tsx", type: "file" as const, code: WALLET_CONNECTION_PROVIDER_TSX }
                  ]
                },
                {
                  name: "lib",
                  path: "./src/lib",
                  type: "directory" as const,
                  children: [
                    { name: "utils.ts", path: "./src/lib/utils.ts", type: "file" as const, code: UTILS_TS }
                  ]
                },
                { name: "globals.css", path: "./src/globals.css", type: "file" as const, code: GLOBALS_CSS }
              ]
            },
            { name: "tailwind.config.js", path: "./tailwind.config.js", type: "file" as const, code: TAILWIND_CONFIG },
            { name: "postcss.config.js", path: "./postcss.config.js", type: "file" as const, code: POSTCSS_CONFIG },
            {
              name: "idl",
              path: "./idl",
              type: "directory" as const,
              children: [
                { name: "solanaflow_token.json", path: "./idl/solanaflow_token.json", type: "file" as const, code: "{}" }
              ]
            }
          ]
        } as FileTreeItem;

        // Insert the UI files
        console.log('[GEN] Inserting token-minting UI files into workspace');
        const uiWriteTaskIds = await insertSrcFiles(
          uiFiles,
          projectId,
          existing, // Reuse existing set to update rather than duplicate files
          /* creatorId */ null
        );

        console.log('[GEN] insertSrcFiles (UI) returned taskIds =', uiWriteTaskIds);

        if (uiWriteTaskIds.length) {
          sendProgress({ stage: 'ui-write', message: 'Writing UI files…' });
          const uiFilesResult = await waitForAll(uiWriteTaskIds);
          console.log('[GEN] UI write tasks done → ok:', uiFilesResult.succeeded, 'fail:', uiFilesResult.failed);
          
          if (uiFilesResult.failed.length) {
            sendProgress({
              stage: 'ui-write-failed',
              message: `UI write: ${uiFilesResult.failed.length} task(s) failed`,
            });
            console.warn(`[GEN] Some UI files failed to write: ${uiFilesResult.failed.join(', ')}`);
          } else {
            sendProgress({ stage: 'ui-gen-done', message: 'Token-minting UI ready' });
          }
        } else {
          console.log('[GEN] insertSrcFiles for UI produced no work');
        }

        // ─────────── Run static lint on Cargo manifests before amending ───────────
        console.log('[GEN] Running static Cargo.toml linter...');
        try {
          await lintWorkspaceManifests({ projectId, userId, workspace });
          console.log('[GEN] Cargo.toml lint passed');
          sendProgress({ stage: 'lint-done', message: 'Cargo manifests validated' });
        } catch (error: unknown) {
          const lintError = error instanceof Error ? error : new Error(String(error));
          console.error('[GEN] Cargo.toml lint failed:', lintError);
          sendProgress({ stage: 'lint-failed', message: `Manifest validation failed: ${lintError.message}` });
          // Continue with amendConfigFiles even if lint fails, as it will fix the issues
        }

        // ─────────── Debug: dump container tree ───────────
        const dumpTaskId = await createTask(
            'Dump Container Tree', null, projectId);
        try {
          await debugDumpContainerTree(
            workspace.containerName,
            workspace.rootPath,
            dumpTaskId,
          );
        } finally {
          // --- Print key files (always run) ---
          try {
            const important = [
              "Anchor.toml",
              "Cargo.toml",
              // generated program files
              `programs/${programName}/src/lib.rs`,
              `programs/${programName}/src/instructions/mod.rs`,
              ...canonicalInstructions.map(i => `programs/${programName}/src/instructions/${i.name}.rs`),
            ];
            // Add state.rs to important files if state exists
            if (canonicalState.length > 0) {
              important.push(`programs/${programName}/src/state.rs`);
            }

            await debugPrintFiles(
              workspace.containerName,
              workspace.rootPath,
              important,
              dumpTaskId,
            );
          } catch (e) {
            console.warn("[DEBUG] failed to print file contents:", e);
          }
          await updateTaskStatus(dumpTaskId, 'succeed', 'Tree dumped and files printed');
        }

        // ────────────────────────── PATCH MANIFESTS ───────────────────────── */
        console.log('[GEN] calling amendConfigFiles (post-generation)…');
        const { anchorTaskId } = await amendConfigFiles(projectId, userId);
        console.log('[GEN] amendConfigFiles result:', { anchorTaskId });
        sendProgress({ stage: 'debug', message: '[handleGenerateCode] Amend done' });
    } catch (err) {
        console.error('Error in handleGenerateCode:', err);
        throw err;
    }
};

function flattenPaths(tree: any[]): string[] {
  const out: string[] = [];
  for (const n of tree ?? []) {
    if (n?.path) out.push(n.path);
    if (Array.isArray(n?.children)) out.push(...flattenPaths(n.children));
  }
  return out;
}
