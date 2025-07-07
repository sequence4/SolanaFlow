export const solMintApp = `"use client"

import { useState } from "react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Copy, ExternalLink, Info, Moon, Sun, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Keypair } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token"

const { BN } = anchor

export default function SolMintApp() {
  const { publicKey, connected, signTransaction, signAllTransactions } = useWallet()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  // Form states
  const [initMintForm, setInitMintForm] = useState({
    decimals: 9,
    mintAuthority: "",
    freezeAuthority: "",
  })

  const [mintTokenForm, setMintTokenForm] = useState({
    destination: "",
    amount: "",
  })

  const [loading, setLoading] = useState({
    initMint: false,
    mintToken: false,
  })

  const [successTx, setSuccessTx] = useState({
    initMint: "",
    mintToken: "",
  })

  const [errors, setErrors] = useState({
    initMint: "",
    mintToken: "",
  })

  const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

  const [mintPubKey, setMintPubKey] = useState<PublicKey | null>(null)

  const shortenAddress = (address: string) => {
    return \`\${address.slice(0, 4)}...\${address.slice(-4)}\`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    })
  }

  const handleInitializeMint = async () => {
    setLoading((prev) => ({ ...prev, initMint: true }))
    setErrors((prev) => ({ ...prev, initMint: "" }))

    try {
      if (!publicKey || !connected) throw new Error("Wallet not connected")
      const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"), "confirmed")
      const anchorWallet = {
        publicKey: publicKey,
        signTransaction: signTransaction,
        signAllTransactions: signAllTransactions,
      }
      const provider = new anchor.AnchorProvider(connection, anchorWallet as anchor.Wallet, anchor.AnchorProvider.defaultOptions())
      anchor.setProvider(provider)
      const programIdKey = new PublicKey(PROGRAM_ID)
      const idl = await anchor.Program.fetchIdl(programIdKey, provider)
      if (!idl) throw new Error("Failed to fetch IDL")
      const program = new anchor.Program(idl, provider)
      const mintAuthorityPubkey = initMintForm.mintAuthority
        ? new PublicKey(initMintForm.mintAuthority)
        : publicKey
      if (initMintForm.freezeAuthority.trim()) {
        toast({
          title: "Note",
          description: "Freeze authority is not supported and will be set to none.",
        })
      }
      const mintAccount = Keypair.generate()
      const txSig = await program.methods
        .initializeMint(initMintForm.decimals, mintAuthorityPubkey)
        .accounts({
          payer: publicKey,
          tokenMint: mintAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintAccount])
        .rpc()
      
      setMintPubKey(mintAccount.publicKey)
      setSuccessTx((prev) => ({ ...prev, initMint: txSig }))
      toast({
        title: "Mint Initialized!",
        description: "Your token mint has been successfully created.",
      })
    } catch (error) {
      setErrors((prev) => ({ ...prev, initMint: "Failed to initialize mint. Please try again." }))
      toast({
        title: "Error",
        description: "Failed to initialize mint",
        variant: "destructive",
      })
    } finally {
      setLoading((prev) => ({ ...prev, initMint: false }))
    }
  }

  const handleMintToken = async () => {
    setLoading((prev) => ({ ...prev, mintToken: true }))
    setErrors((prev) => ({ ...prev, mintToken: "" }))

    try {
      if (!publicKey || !connected) throw new Error("Wallet not connected")
      if (!mintPubKey) throw new Error("Mint not initialized")
      const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"), "confirmed")
      const anchorWallet = {
        publicKey: publicKey,
        signTransaction: signTransaction,
        signAllTransactions: signAllTransactions,
      }
      const provider = new anchor.AnchorProvider(connection, anchorWallet as anchor.Wallet, anchor.AnchorProvider.defaultOptions())
      anchor.setProvider(provider)
      const programIdKey = new PublicKey(PROGRAM_ID)
      const idl = await anchor.Program.fetchIdl(programIdKey, provider)
      if (!idl) throw new Error("Failed to fetch IDL")
      const program = new anchor.Program(idl, provider)
      const mintAuthorityPubkey = initMintForm.mintAuthority
        ? new PublicKey(initMintForm.mintAuthority)
        : publicKey
      if (!publicKey.equals(mintAuthorityPubkey)) {
        throw new Error("Current wallet is not the mint authority")
      }
      const destinationPubkey = new PublicKey(mintTokenForm.destination)
      const ata = await getAssociatedTokenAddress(mintPubKey, destinationPubkey)
      const ataInfo = await connection.getAccountInfo(ata)
      const preIx: anchor.web3.TransactionInstruction[] = []
      if (!ataInfo) {
        preIx.push(createAssociatedTokenAccountInstruction(publicKey, ata, destinationPubkey, mintPubKey))
      }
      const amountBN = new BN(mintTokenForm.amount)
      const txSig = await program.methods
        .mintTo(amountBN)
        .accounts({
          mintAuthority: publicKey,
          tokenMint: mintPubKey,
          destinationTokenAccount: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preIx)
        .rpc()
      
      setSuccessTx((prev) => ({ ...prev, mintToken: txSig }))
      toast({
        title: "Tokens Minted!",
        description: \`Successfully minted \${mintTokenForm.amount} tokens.\`,
      })
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        mintToken: (error as Error).message.includes("Mint not initialized")
          ? "Please initialize a mint first."
          : "Failed to mint tokens. Please try again.",
      }))
      toast({
        title: "Error",
        description: "Failed to mint tokens",
        variant: "destructive",
      })
    } finally {
      setLoading((prev) => ({ ...prev, mintToken: false }))
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30">
        {/* Optional whimsical blob background */}
        <div className="fixed top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-200/10 to-purple-200/10 rounded-full blur-3xl -z-10" />

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SolMint
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Program ID:</span>
                <Badge
                  variant="outline"
                  className="font-mono cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => copyToClipboard(PROGRAM_ID)}
                >
                  {shortenAddress(PROGRAM_ID)}
                  <Copy className="w-3 h-3 ml-1" />
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              <div className="wallet-adapter-button-container">
                <WalletMultiButton className="!bg-gradient-to-r !from-blue-500 !to-purple-500 hover:!from-blue-600 hover:!to-purple-600 !rounded-full !px-6 !py-2 !text-white !font-medium !transition-all !duration-300 hover:!scale-105 !shadow-lg" />
              </div>

              {connected && publicKey && (
                <Badge variant="secondary" className="font-mono">
                  {shortenAddress(publicKey.toString())}
                </Badge>
              )}
            </div>
          </div>

          {!connected && (
            <Alert className="mb-8 border-blue-200 bg-blue-50/50">
              <Info className="h-4 w-4" />
              <AlertDescription>Please connect your wallet to start minting tokens.</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-8 md:grid-cols-2">
            {/* Initialize Mint Card */}
            <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-lg rounded-3xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold text-gray-800">Initialize Mint</CardTitle>
                <CardDescription className="text-gray-600">
                  Create a new SPL token mint with custom parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="decimals" className="text-sm font-medium">
                      Decimals
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of decimal places for your token (0-9)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="decimals"
                    type="number"
                    min="0"
                    max="9"
                    value={initMintForm.decimals}
                    onChange={(e) =>
                      setInitMintForm((prev) => ({ ...prev, decimals: Number.parseInt(e.target.value) || 0 }))
                    }
                    className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                    disabled={!connected}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mintAuthority" className="text-sm font-medium">
                    Mint Authority
                  </Label>
                  <Input
                    id="mintAuthority"
                    placeholder="Enter mint authority public key"
                    value={initMintForm.mintAuthority}
                    onChange={(e) => setInitMintForm((prev) => ({ ...prev, mintAuthority: e.target.value }))}
                    className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20 font-mono text-sm"
                    disabled={!connected}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="freezeAuthority" className="text-sm font-medium">
                    Freeze Authority (Optional)
                  </Label>
                  <Input
                    id="freezeAuthority"
                    placeholder="Enter freeze authority public key"
                    value={initMintForm.freezeAuthority}
                    onChange={(e) => setInitMintForm((prev) => ({ ...prev, freezeAuthority: e.target.value }))}
                    className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20 font-mono text-sm"
                    disabled={!connected}
                  />
                </div>

                {errors.initMint && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>{errors.initMint}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleInitializeMint}
                  disabled={!connected || loading.initMint}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl py-6 font-medium transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  {loading.initMint ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    "Initialize Mint"
                  )}
                </Button>

                {successTx.initMint && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View on Explorer
                    </Badge>
                    <span className="text-sm text-green-700 font-mono">{shortenAddress(successTx.initMint)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mint New Token Card */}
            <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-lg rounded-3xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold text-gray-800">Mint New Token</CardTitle>
                <CardDescription className="text-gray-600">Mint tokens to a destination address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="destination" className="text-sm font-medium">
                    Destination Address
                  </Label>
                  <Input
                    id="destination"
                    placeholder="Enter destination wallet address"
                    value={mintTokenForm.destination}
                    onChange={(e) => setMintTokenForm((prev) => ({ ...prev, destination: e.target.value }))}
                    className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20 font-mono text-sm"
                    disabled={!connected}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="amount" className="text-sm font-medium">
                      Amount
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of tokens to mint (u64 format)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount to mint"
                    value={mintTokenForm.amount}
                    onChange={(e) => setMintTokenForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                    disabled={!connected}
                  />
                </div>

                {errors.mintToken && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>{errors.mintToken}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleMintToken}
                  disabled={!connected || loading.mintToken || !mintTokenForm.destination || !mintTokenForm.amount}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl py-6 font-medium transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  {loading.mintToken ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    "Mint Token"
                  )}
                </Button>

                {successTx.mintToken && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View on Explorer
                    </Badge>
                    <span className="text-sm text-green-700 font-mono">{shortenAddress(successTx.mintToken)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}`; 