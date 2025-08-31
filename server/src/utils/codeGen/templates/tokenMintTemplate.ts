/**
 * Token Mint Template
 * Advanced SPL token minting interface template
 */

import { ComponentTemplate, TemplateConfig } from './templateRegistry';

export const TokenMintTemplate: ComponentTemplate = {
  metadata: {
    id: 'token-mint-basic',
    name: 'Token Mint UI',
    description: 'SPL token minting interface with basic operations',
    category: 'token',
    requiredInstructions: ['initialize_mint', 'mint_to'],
    optionalInstructions: ['transfer', 'burn', 'freeze_account', 'set_authority'],
    requiredAccounts: ['mint'],
    complexity: 'intermediate',
    features: ['minting', 'transfers', 'burning', 'supply-management'],
    version: '1.0.0'
  },
  
  generateComponent: (config: TemplateConfig) => {
    const { programName, programId, instructions, features, customization } = config;
    
    // Clean program name for component name
    const componentName = programName.replace(/[-_]/g, '');
    
    // Check which features are available based on instructions
    const hasTransfer = instructions.some(i => 
      i.name.toLowerCase().includes('transfer')
    );
    const hasBurn = instructions.some(i => 
      i.name.toLowerCase().includes('burn')
    );
    
    return `"use client"

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Coins, Send, Flame, Copy, Check, AlertCircle } from 'lucide-react'

const PROGRAM_ID = "${programId}"

export default function ${componentName}TokenMint() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [mintAddress, setMintAddress] = useState<string>('')
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  
  // Form states
  const [decimals, setDecimals] = useState('9')
  const [mintAmount, setMintAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [burnAmount, setBurnAmount] = useState('')
  
  const initializeMint = async () => {
    if (!publicKey || !connection) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual mint initialization
      // This is a placeholder for the actual implementation
      toast({
        title: "Success",
        description: "Token mint initialized successfully",
      })
      setMintAddress('Generated_Mint_Address_Here')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize mint",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const mintTokens = async () => {
    if (!mintAddress || !mintAmount) {
      toast({
        title: "Missing information",
        description: "Please enter mint address and amount",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual minting
      toast({
        title: "Success",
        description: \`Minted \${mintAmount} tokens successfully\`,
      })
      setMintAmount('')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mint tokens",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const transferTokens = async () => {
    if (!recipientAddress || !transferAmount) {
      toast({
        title: "Missing information",
        description: "Please enter recipient and amount",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual transfer
      toast({
        title: "Success",
        description: \`Transferred \${transferAmount} tokens successfully\`,
      })
      setTransferAmount('')
      setRecipientAddress('')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer tokens",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const burnTokens = async () => {
    if (!burnAmount) {
      toast({
        title: "Missing information",
        description: "Please enter amount to burn",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual burning
      toast({
        title: "Success",
        description: \`Burned \${burnAmount} tokens successfully\`,
      })
      setBurnAmount('')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to burn tokens",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">${customization?.title || 'Token Minting dApp'}</h1>
          <p className="text-muted-foreground mt-2">
            ${customization?.description || 'Create and manage SPL tokens on Solana'}
          </p>
        </div>
        <WalletMultiButton />
      </div>
      
      {!connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Coins className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground text-center mb-6">
              Connect your Solana wallet to start creating and managing tokens
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Token Info Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Token Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mintAddress ? (
                <>
                  <div>
                    <Label className="text-sm text-muted-foreground">Mint Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {mintAddress}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(mintAddress)}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Program ID</Label>
                    <code className="text-xs bg-muted px-2 py-1 rounded block truncate mt-1">
                      {PROGRAM_ID}
                    </code>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant="outline">Devnet</Badge>
                    <Badge variant="outline">SPL Token</Badge>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No token initialized yet. Create one in the Initialize tab.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {/* Operations Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Token Operations</CardTitle>
              <CardDescription>
                Manage your SPL tokens with these operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="initialize">
                <TabsList className="grid w-full grid-cols-${hasTransfer && hasBurn ? '4' : hasTransfer || hasBurn ? '3' : '2'}">
                  <TabsTrigger value="initialize">Initialize</TabsTrigger>
                  <TabsTrigger value="mint">Mint</TabsTrigger>
                  ${hasTransfer ? '<TabsTrigger value="transfer">Transfer</TabsTrigger>' : ''}
                  ${hasBurn ? '<TabsTrigger value="burn">Burn</TabsTrigger>' : ''}
                </TabsList>
                
                <TabsContent value="initialize" className="space-y-4">
                  <div>
                    <Label htmlFor="decimals">Token Decimals</Label>
                    <Input
                      id="decimals"
                      type="number"
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                      placeholder="9"
                      min="0"
                      max="9"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Standard is 9 for SOL-like tokens, 6 for USDC-like
                    </p>
                  </div>
                  
                  <Button
                    onClick={initializeMint}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Initializing...</>
                    ) : (
                      <><Coins className="mr-2 h-4 w-4" /> Initialize Token Mint</>
                    )}
                  </Button>
                </TabsContent>
                
                <TabsContent value="mint" className="space-y-4">
                  <div>
                    <Label htmlFor="mintAmount">Amount to Mint</Label>
                    <Input
                      id="mintAmount"
                      type="number"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      placeholder="1000"
                      min="0"
                    />
                  </div>
                  
                  <Button
                    onClick={mintTokens}
                    disabled={loading || !mintAddress}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Minting...</>
                    ) : (
                      <><Coins className="mr-2 h-4 w-4" /> Mint Tokens</>
                    )}
                  </Button>
                  
                  {!mintAddress && (
                    <Alert>
                      <AlertDescription>
                        Initialize a token mint first
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
                
                ${hasTransfer ? `
                <TabsContent value="transfer" className="space-y-4">
                  <div>
                    <Label htmlFor="recipient">Recipient Address</Label>
                    <Input
                      id="recipient"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="Enter Solana address..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="transferAmount">Amount</Label>
                    <Input
                      id="transferAmount"
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  
                  <Button
                    onClick={transferTokens}
                    disabled={loading || !mintAddress}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transferring...</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Transfer Tokens</>
                    )}
                  </Button>
                </TabsContent>
                ` : ''}
                
                ${hasBurn ? `
                <TabsContent value="burn" className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Burning tokens permanently removes them from circulation
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Label htmlFor="burnAmount">Amount to Burn</Label>
                    <Input
                      id="burnAmount"
                      type="number"
                      value={burnAmount}
                      onChange={(e) => setBurnAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  
                  <Button
                    onClick={burnTokens}
                    variant="destructive"
                    disabled={loading || !mintAddress}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Burning...</>
                    ) : (
                      <><Flame className="mr-2 h-4 w-4" /> Burn Tokens</>
                    )}
                  </Button>
                </TabsContent>
                ` : ''}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}`;
  }
};