export const solMintApp = `"use client"

import { useState, useEffect } from "react"
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
import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token"
import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction
} from "@metaplex-foundation/mpl-token-metadata"

const { BN } = anchor

export default function SolMintApp() {
  const { publicKey, connected, signTransaction, signAllTransactions } = useWallet()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  /* ---------- runtime helpers ---------- */
  const isBrowser    = typeof window !== "undefined";
  const isStandalone = isBrowser && window.parent === window;   // running top‑level, *not* inside iframe

  /* ───────── wallet info coming from the parent window ───────── */
  const [parentWallet, setParentWallet] =
    useState<{ connected: boolean; publicKey: string | null }>({
      connected: false,
      publicKey: null
    });

  useEffect(() => {
    if (!isBrowser) return;                       // guard during SSR
    function handleParentMsg(event: MessageEvent) {
      const { type, publicKey: pk } = event.data || {};
      if (type === "WALLET_CONNECTED" && pk) {
        setParentWallet({ connected: true, publicKey: pk });
        /* auto‑prefill mint authority if user didn't type anything */
        setInitMintForm(prev =>
          prev.mintAuthority ? prev : { ...prev, mintAuthority: pk }
        );
      }
    }
    window.addEventListener("message", handleParentMsg);
    /* ask parent for wallet on boot */
    if (!isStandalone)
      window.parent.postMessage({ type: "REQUEST_WALLET_CONNECT" }, "*");
    return () => window.removeEventListener("message", handleParentMsg);
  }, [isBrowser, isStandalone]);

  /* helper flags that work with either in‑iframe extension _or_ parent bridge */
  const walletReady = connected || parentWallet.connected;
  const walletPubKey = connected && publicKey ? publicKey.toString() : parentWallet.publicKey;

  // Form states
  const [initMintForm, setInitMintForm] = useState({
    decimals: 9,
    mintAuthority: "",
    freezeAuthority: "",
    name: "",
    symbol: "",
    uri: "",
    createMetadata: true,
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
    metadata: "",
  })

  const [errors, setErrors] = useState({
    initMint: "",
    mintToken: "",
    metadata: "",
  })

  const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

  // State to store the created mint's public key for later use
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

  const createMetadataAccount = async (
    connection: anchor.web3.Connection,
    mintKey: PublicKey,
    mintAuthorityKey: PublicKey,
    payerKey: PublicKey,
    name: string,
    symbol: string,
    uri: string
  ) => {
    try {
      // Derive the metadata account PDA
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKey.toBuffer()],
        METADATA_PROGRAM_ID
      )
      
      // Create the metadata instruction
      const metadataInstruction = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAccount,
          mint: mintKey,
          mintAuthority: mintAuthorityKey,
          payer: payerKey,
          updateAuthority: mintAuthorityKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name,
              symbol,
              uri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      )

      // Create and send the transaction
      const transaction = new Transaction().add(metadataInstruction)
      transaction.feePayer = payerKey
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash

      if (!signTransaction) throw new Error("Wallet does not support signing")
      const signedTx = await signTransaction(transaction)
      const txId = await connection.sendRawTransaction(signedTx.serialize())
      await connection.confirmTransaction(txId)
      
      return { txId, metadataAccount }
    } catch (error) {
      console.error("Error creating metadata account:", error)
      throw error
    }
  }

  const handleInitializeMint = async () => {
    setLoading((prev) => ({ ...prev, initMint: true }))
    setErrors((prev) => ({ ...prev, initMint: "", metadata: "" }))
    setSuccessTx((prev) => ({ ...prev, metadata: "" }))

    try {
      if (!publicKey || !connected) throw new Error("Wallet not connected")
      // Set up Anchor provider and program
      const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"), "confirmed")
      const anchorWallet = {
        publicKey: publicKey,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions!,
      }
      const provider = new anchor.AnchorProvider(connection, anchorWallet as anchor.Wallet, anchor.AnchorProvider.defaultOptions())
      anchor.setProvider(provider)
      const programIdKey = new PublicKey(PROGRAM_ID)
      const idl = await anchor.Program.fetchIdl(programIdKey, provider)
      if (!idl) throw new Error("Failed to fetch IDL for program")
      const program = new anchor.Program(idl, provider)
      // Determine mint authority (use wallet if none provided)
      const mintAuthorityPubkey = initMintForm.mintAuthority
        ? new PublicKey(initMintForm.mintAuthority)
        : publicKey
      // Warn if freeze authority is provided (not supported by program)
      if (initMintForm.freezeAuthority.trim()) {
        toast({
          title: "Note",
          description: "Freeze authority is not supported and will be set to none.",
        })
      }
      // Generate a new Keypair for the token mint account
      const mintAccount = Keypair.generate()
      // Call initialize_mint instruction on the Anchor program using fluent methods API
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
      
      // Save mint public key for use in mintToken step
      setMintPubKey(mintAccount.publicKey)
      setSuccessTx((prev) => ({ ...prev, initMint: txSig }))
      toast({
        title: "Mint Initialized!",
        description: "Your token mint has been successfully created.",
      })

      // Create metadata if requested and fields are provided
      if (
        initMintForm.createMetadata && 
        initMintForm.name.trim() && 
        initMintForm.symbol.trim() && 
        initMintForm.uri.trim()
      ) {
        try {
          const { txId, metadataAccount } = await createMetadataAccount(
            connection,
            mintAccount.publicKey,
            mintAuthorityPubkey,
            publicKey,
            initMintForm.name.trim(),
            initMintForm.symbol.trim(),
            initMintForm.uri.trim()
          )
          
          setSuccessTx((prev) => ({ ...prev, metadata: txId }))
          toast({
            title: "Metadata Created!",
            description: "Token metadata has been successfully created.",
          })
        } catch (error) {
          console.error("Metadata creation error:", error)
          setErrors((prev) => ({ 
            ...prev, 
            metadata: "Failed to create metadata. Mint was created successfully, but metadata creation failed." 
          }))
          toast({
            title: "Metadata Error",
            description: "Failed to create token metadata",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("InitializeMint error:", error)
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
      // Set up Anchor provider and program (reuse connection and wallet)
      const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"), "confirmed")
      const anchorWallet = {
        publicKey: publicKey,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions!,
      }
      const provider = new anchor.AnchorProvider(connection, anchorWallet as anchor.Wallet, anchor.AnchorProvider.defaultOptions())
      anchor.setProvider(provider)
      const programIdKey = new PublicKey(PROGRAM_ID)
      const idl = await anchor.Program.fetchIdl(programIdKey, provider)
      if (!idl) throw new Error("Failed to fetch IDL for program")
      const program = new anchor.Program(idl, provider)
      // Mint authority must match the one set during initialization
      const mintAuthorityPubkey = initMintForm.mintAuthority
        ? new PublicKey(initMintForm.mintAuthority)
        : publicKey
      if (!publicKey.equals(mintAuthorityPubkey)) {
        throw new Error("Current wallet is not the mint authority")
      }
      // Parse destination address and get/create associated token account
      const destinationPubkey = new PublicKey(mintTokenForm.destination)
      const ata = await getAssociatedTokenAddress(mintPubKey, destinationPubkey)
      const ataInfo = await connection.getAccountInfo(ata)
      const preIx: anchor.web3.TransactionInstruction[] = []
      if (!ataInfo) {
        preIx.push(
          createAssociatedTokenAccountInstruction(publicKey, ata, destinationPubkey, mintPubKey)
        )
      }
      // Call mint_to instruction on the Anchor program using fluent methods API
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
      console.error("MintToken error:", error)
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

              {/* wallet UI: standalone ↔ iframe bridge */}
              {isStandalone ? (
              <div className="wallet-adapter-button-container">
                <WalletMultiButton className="!bg-gradient-to-r !from-blue-500 !to-purple-500 hover:!from-blue-600 hover:!to-purple-600 !rounded-full !px-6 !py-2 !text-white !font-medium !transition-all !duration-300 hover:!scale-105 !shadow-lg" />
              </div>
              ) : (
                <Button
                  onClick={() =>
                    isBrowser &&
                    window.parent.postMessage({ type: "REQUEST_WALLET_CONNECT" }, "*")
                  }
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full px-6 py-2"
                >
                  {walletReady ? "Wallet Connected" : "Connect Wallet"}
                </Button>
              )}

              {walletReady && walletPubKey && (
                <Badge variant="secondary" className="font-mono">
                  {shortenAddress(walletPubKey)}
                </Badge>
              )}
            </div>
          </div>

          {!walletReady && (
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
                    disabled={!walletReady}
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
                    disabled={!walletReady}
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
                    disabled={!walletReady}
                  />
                </div>

                {/* Metadata fields */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Label htmlFor="createMetadata" className="text-sm font-medium cursor-pointer">
                      Create Token Metadata
                    </Label>
                    <input
                      id="createMetadata"
                      type="checkbox"
                      checked={initMintForm.createMetadata}
                      onChange={(e) => setInitMintForm((prev) => ({ ...prev, createMetadata: e.target.checked }))}
                      className="rounded border-blue-200 text-blue-500 focus:ring-blue-400/20"
                    />
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Create on-chain metadata for your token (name, symbol, URI)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {initMintForm.createMetadata && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="tokenName" className="text-sm font-medium">
                          Token Name
                        </Label>
                        <Input
                          id="tokenName"
                          placeholder="Enter token name"
                          value={initMintForm.name}
                          onChange={(e) => setInitMintForm((prev) => ({ ...prev, name: e.target.value }))}
                          className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                          disabled={!walletReady}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tokenSymbol" className="text-sm font-medium">
                          Token Symbol
                        </Label>
                        <Input
                          id="tokenSymbol"
                          placeholder="Enter token symbol (max 10 chars)"
                          value={initMintForm.symbol}
                          onChange={(e) => setInitMintForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase().slice(0, 10) }))}
                          className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                          disabled={!walletReady}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tokenUri" className="text-sm font-medium">
                          Token URI
                        </Label>
                        <Input
                          id="tokenUri"
                          placeholder="Enter metadata URI (JSON)"
                          value={initMintForm.uri}
                          onChange={(e) => setInitMintForm((prev) => ({ ...prev, uri: e.target.value }))}
                          className="rounded-xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
                          disabled={!walletReady}
                        />
                        <p className="text-xs text-gray-500">
                          URI should point to a JSON file following the{" "}
                          <a
                            href="https://docs.metaplex.com/programs/token-metadata/token-standard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            Metaplex standard
                          </a>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {errors.initMint && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>{errors.initMint}</AlertDescription>
                  </Alert>
                )}

                {errors.metadata && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>{errors.metadata}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleInitializeMint}
                  disabled={!walletReady || loading.initMint}
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

                {successTx.metadata && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Metadata TX
                    </Badge>
                    <span className="text-sm text-green-700 font-mono">{shortenAddress(successTx.metadata)}</span>
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
                    disabled={!walletReady}
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
                    disabled={!walletReady}
                  />
                </div>

                {errors.mintToken && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>{errors.mintToken}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleMintToken}
                  disabled={!walletReady || loading.mintToken || !mintTokenForm.destination || !mintTokenForm.amount}
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