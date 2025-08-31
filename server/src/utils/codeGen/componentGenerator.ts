import { FileTreeItem } from "../../types/FileTreeItem";
import { Graph } from "../../types/graph";

export interface ComponentConfig {
  type: 'token-mint' | 'nft-mint' | 'defi-swap' | 'custom';
  name: string;
  programId: string;
  features: string[];
}

/**
 * Generates UI components based on the program structure
 */
export async function generateUIComponents(
  graph: Graph,
  programName: string,
  programId: string
): Promise<FileTreeItem> {
  // Analyze graph to determine component type
  const config = analyzeGraphForComponentType(graph, programId);
  
  // Generate component based on type
  const componentCode = generateComponentCode(config, programName, programId);
  
  // Generate config file
  const configCode = generateConfigFile(config, programName);
  
  return {
    name: "web",
    path: "web",
    type: "directory",
    children: [
      {
        name: "src",
        path: "web/src",
        type: "directory",
        children: [
          {
            name: "components",
            path: "web/src/components",
            type: "directory",
            children: [
              {
                name: "generated",
                path: "web/src/components/generated",
                type: "directory",
                children: [
                  {
                    name: `${programName}App.tsx`,
                    path: `web/src/components/generated/${programName}App.tsx`,
                    type: "file",
                    code: componentCode
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        name: "public",
        path: "web/public",
        type: "directory",
        children: [
          {
            name: "config",
            path: "web/public/config",
            type: "directory",
            children: [
              {
                name: "component-manifest.json",
                path: "web/public/config/component-manifest.json",
                type: "file",
                code: configCode
              }
            ]
          }
        ]
      }
    ]
  };
}

function analyzeGraphForComponentType(graph: Graph, programId: string): ComponentConfig {
  // Analyze nodes to determine what kind of dApp this is
  const hasInitMint = graph.nodes.some(n => {
    const name = (n.config?.name as string) || '';
    return n.type === 'instruction' && 
      (name.toLowerCase().includes('initialize_mint') || 
       name.toLowerCase().includes('init_mint'));
  });
  
  const hasMintTo = graph.nodes.some(n => {
    const name = (n.config?.name as string) || '';
    return n.type === 'instruction' && 
      (name.toLowerCase().includes('mint_to') ||
       name.toLowerCase().includes('mint'));
  });
  
  const hasTransfer = graph.nodes.some(n => {
    const name = (n.config?.name as string) || '';
    return n.type === 'instruction' &&
      name.toLowerCase().includes('transfer');
  });
  
  const features: string[] = [];
  if (hasInitMint) features.push('initialize_mint');
  if (hasMintTo) features.push('mint_to');
  if (hasTransfer) features.push('transfer');
  
  // Determine component type based on features
  if (hasInitMint && hasMintTo) {
    return {
      type: 'token-mint',
      name: 'TokenMintApp',
      programId,
      features
    };
  }
  
  // Default to custom
  return {
    type: 'custom',
    name: 'CustomApp',
    programId,
    features
  };
}

function generateComponentCode(
  config: ComponentConfig,
  programName: string,
  programId: string
): string {
  // For token mint, generate specific UI
  if (config.type === 'token-mint') {
    return generateTokenMintComponent(programName, programId, config.features);
  }
  
  // Default template for custom components
  return `"use client"

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

export default function ${programName}App() {
  const { publicKey, connected } = useWallet()
  const { toast } = useToast()
  const programId = "${programId}"
  
  const handleAction = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }
    
    try {
      // TODO: Implement program interaction
      toast({
        title: "Success",
        description: "Transaction completed successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      })
    }
  }
  
  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-end mb-4">
        <WalletMultiButton />
      </div>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>${programName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Program ID: <code className="text-xs">{programId}</code>
            </AlertDescription>
          </Alert>
          
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {connected 
                ? \`Connected: \${publicKey?.toBase58().slice(0, 4)}...\${publicKey?.toBase58().slice(-4)}\`
                : 'Please connect your wallet to continue'}
            </p>
            
            <Button 
              onClick={handleAction}
              disabled={!connected}
              size="lg"
            >
              Execute Transaction
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}`;
}

function generateTokenMintComponent(
  programName: string,
  programId: string,
  features: string[]
): string {
  // Generate a simplified token mint component
  // In a real implementation, this would include the full SolMintApp logic
  return `"use client"

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Coins, Send } from 'lucide-react'

const PROGRAM_ID = "${programId}"

export default function ${programName}App() {
  const { publicKey, connected } = useWallet()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [mintAddress, setMintAddress] = useState('')
  const [mintAmount, setMintAmount] = useState('')
  
  const features = ${JSON.stringify(features)}
  
  const handleInitializeMint = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)
    try {
      // TODO: Implement mint initialization
      // This would call the initialize_mint instruction
      toast({
        title: "Mint Initialized",
        description: "Your token mint has been created successfully"
      })
      setMintAddress('Generated_Mint_Address_Here')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initialize mint",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleMintTokens = async () => {
    if (!mintAddress || !mintAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter mint address and amount",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)
    try {
      // TODO: Implement mint_to instruction
      toast({
        title: "Tokens Minted",
        description: \`Successfully minted \${mintAmount} tokens\`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mint tokens",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Token Mint dApp</h1>
        <WalletMultiButton />
      </div>
      
      <div className="grid gap-6">
        {/* Program Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Program Information</CardTitle>
            <CardDescription>Connected to Solana program</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Program ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{PROGRAM_ID}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Features:</span>
                <div className="flex gap-1">
                  {features.map(f => (
                    <Badge key={f} variant="secondary">{f}</Badge>
                  ))}
                </div>
              </div>
              {connected && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Wallet:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Initialize Mint Card */}
        {features.includes('initialize_mint') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Initialize Token Mint
              </CardTitle>
              <CardDescription>Create a new SPL token mint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mintAddress && (
                  <Alert>
                    <AlertDescription>
                      Mint Address: <code className="text-xs">{mintAddress}</code>
                    </AlertDescription>
                  </Alert>
                )}
                <Button 
                  onClick={handleInitializeMint}
                  disabled={!connected || isLoading || !!mintAddress}
                  className="w-full"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Initializing...</>
                  ) : (
                    'Initialize Mint'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Mint Tokens Card */}
        {features.includes('mint_to') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Mint Tokens
              </CardTitle>
              <CardDescription>Mint new tokens to an account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mint-address">Mint Address</Label>
                  <Input
                    id="mint-address"
                    placeholder="Enter mint address or use initialized mint"
                    value={mintAddress}
                    onChange={(e) => setMintAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mint-amount">Amount</Label>
                  <Input
                    id="mint-amount"
                    type="number"
                    placeholder="Enter amount to mint"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleMintTokens}
                  disabled={!connected || isLoading || !mintAddress || !mintAmount}
                  className="w-full"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Minting...</>
                  ) : (
                    'Mint Tokens'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}`;
}

function generateConfigFile(config: ComponentConfig, programName: string): string {
  return JSON.stringify({
    componentType: config.type,
    componentName: `${programName}App`,
    customComponent: true,
    baseType: config.type !== 'custom' ? config.type : null,
    programId: config.programId,
    features: config.features,
    generatedAt: new Date().toISOString(),
    version: "1.0.0"
  }, null, 2);
}