/**
 * NFT Mint Template
 * Template for NFT minting interfaces with metadata management
 */

import { ComponentTemplate, TemplateConfig } from './templateRegistry';

export const NFTMintTemplate: ComponentTemplate = {
  metadata: {
    id: 'nft-mint-basic',
    name: 'NFT Mint UI',
    description: 'NFT minting interface with metadata and collection management',
    category: 'nft',
    requiredInstructions: ['create_metadata', 'create_master_edition'],
    optionalInstructions: ['update_metadata', 'verify_collection', 'set_collection_size', 'burn_nft'],
    requiredAccounts: ['metadata', 'edition'],
    complexity: 'intermediate',
    features: ['metadata', 'collections', 'editions', 'royalties'],
    version: '1.0.0'
  },
  
  generateComponent: (config: TemplateConfig) => {
    const { programName, programId, instructions, features, customization } = config;
    
    const componentName = programName.replace(/[-_]/g, '');
    
    // Check available features
    const hasCollection = instructions.some(i => 
      i.name.toLowerCase().includes('collection')
    );
    const hasUpdate = instructions.some(i => 
      i.name.toLowerCase().includes('update')
    );
    const hasBurn = instructions.some(i => 
      i.name.toLowerCase().includes('burn')
    );
    
    return `"use client"

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  Loader2, 
  Image, 
  Upload, 
  FileText, 
  Hash, 
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Grid3x3,
  Flame
} from 'lucide-react'

const PROGRAM_ID = "${programId}"

interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    creators: Array<{
      address: string;
      share: number;
    }>;
    files: Array<{
      uri: string;
      type: string;
    }>;
  };
}

export default function ${componentName}NFTMint() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [mintedNFT, setMintedNFT] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  // NFT Metadata form states
  const [nftName, setNftName] = useState('')
  const [nftSymbol, setNftSymbol] = useState('')
  const [nftDescription, setNftDescription] = useState('')
  const [nftImage, setNftImage] = useState('')
  const [royaltyPercentage, setRoyaltyPercentage] = useState('5')
  const [collectionAddress, setCollectionAddress] = useState('')
  const [attributes, setAttributes] = useState<Array<{trait_type: string; value: string}>>([
    { trait_type: '', value: '' }
  ])
  
  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }])
  }
  
  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const newAttributes = [...attributes]
    newAttributes[index][field] = value
    setAttributes(newAttributes)
  }
  
  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index))
  }
  
  const mintNFT = async () => {
    if (!publicKey || !connection) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }
    
    if (!nftName || !nftSymbol || !nftImage) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual NFT minting
      const metadata: NFTMetadata = {
        name: nftName,
        symbol: nftSymbol,
        description: nftDescription,
        image: nftImage,
        attributes: attributes.filter(a => a.trait_type && a.value),
        properties: {
          creators: [{
            address: publicKey.toBase58(),
            share: 100
          }],
          files: [{
            uri: nftImage,
            type: 'image/png'
          }]
        }
      }
      
      console.log('Minting NFT with metadata:', metadata)
      
      toast({
        title: "Success",
        description: "NFT minted successfully!",
      })
      
      // Mock minted NFT address
      setMintedNFT('NFT_' + Math.random().toString(36).substring(7))
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mint NFT",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const updateNFTMetadata = async () => {
    if (!mintedNFT) {
      toast({
        title: "No NFT selected",
        description: "Please mint an NFT first",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement metadata update
      toast({
        title: "Success",
        description: "NFT metadata updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update metadata",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const burnNFT = async () => {
    if (!mintedNFT) {
      toast({
        title: "No NFT selected",
        description: "Please select an NFT to burn",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement NFT burning
      toast({
        title: "Success",
        description: "NFT burned successfully",
      })
      setMintedNFT(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to burn NFT",
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8" />
            ${customization?.title || 'NFT Minting Studio'}
          </h1>
          <p className="text-muted-foreground mt-2">
            ${customization?.description || 'Create and manage NFTs on Solana'}
          </p>
        </div>
        <WalletMultiButton />
      </div>
      
      {!connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground text-center mb-6">
              Connect your Solana wallet to start minting NFTs
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* NFT Info Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>NFT Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mintedNFT ? (
                <>
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    {nftImage ? (
                      <img src={nftImage} alt={nftName} className="rounded-lg object-cover w-full h-full" />
                    ) : (
                      <Image className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">NFT Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {mintedNFT}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(mintedNFT)}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Name:</span>
                      <span className="text-sm font-medium">{nftName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Symbol:</span>
                      <span className="text-sm font-medium">{nftSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Royalty:</span>
                      <span className="text-sm font-medium">{royaltyPercentage}%</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant="outline">NFT</Badge>
                    <Badge variant="outline">Metaplex</Badge>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No NFT minted yet. Create one in the Mint tab.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {/* Operations Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>NFT Operations</CardTitle>
              <CardDescription>
                Create and manage your NFTs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mint">
                <TabsList className="grid w-full grid-cols-${hasUpdate && hasBurn ? '3' : hasUpdate || hasBurn ? '2' : '1'}">
                  <TabsTrigger value="mint">Mint</TabsTrigger>
                  ${hasUpdate ? '<TabsTrigger value="update">Update</TabsTrigger>' : ''}
                  ${hasBurn ? '<TabsTrigger value="burn">Burn</TabsTrigger>' : ''}
                </TabsList>
                
                <TabsContent value="mint" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="nftName">NFT Name *</Label>
                      <Input
                        id="nftName"
                        value={nftName}
                        onChange={(e) => setNftName(e.target.value)}
                        placeholder="My Awesome NFT"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="nftSymbol">Symbol *</Label>
                      <Input
                        id="nftSymbol"
                        value={nftSymbol}
                        onChange={(e) => setNftSymbol(e.target.value)}
                        placeholder="AWESOME"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="nftDescription">Description</Label>
                    <Textarea
                      id="nftDescription"
                      value={nftDescription}
                      onChange={(e) => setNftDescription(e.target.value)}
                      placeholder="Describe your NFT..."
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="nftImage">Image URL *</Label>
                    <Input
                      id="nftImage"
                      value={nftImage}
                      onChange={(e) => setNftImage(e.target.value)}
                      placeholder="https://arweave.net/..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload your image to Arweave or IPFS first
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="royalty">Royalty Percentage</Label>
                    <Input
                      id="royalty"
                      type="number"
                      value={royaltyPercentage}
                      onChange={(e) => setRoyaltyPercentage(e.target.value)}
                      placeholder="5"
                      min="0"
                      max="50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Percentage of secondary sales (0-50%)
                    </p>
                  </div>
                  
                  ${hasCollection ? `
                  <div>
                    <Label htmlFor="collection">Collection Address (Optional)</Label>
                    <Input
                      id="collection"
                      value={collectionAddress}
                      onChange={(e) => setCollectionAddress(e.target.value)}
                      placeholder="Collection mint address..."
                    />
                  </div>
                  ` : ''}
                  
                  <div>
                    <Label>Attributes</Label>
                    <div className="space-y-2">
                      {attributes.map((attr, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Trait type"
                            value={attr.trait_type}
                            onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                          />
                          <Input
                            placeholder="Value"
                            value={attr.value}
                            onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => removeAttribute(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addAttribute}
                      >
                        Add Attribute
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    onClick={mintNFT}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Minting...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Mint NFT</>
                    )}
                  </Button>
                </TabsContent>
                
                ${hasUpdate ? `
                <TabsContent value="update" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Select an NFT to update its metadata
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Label htmlFor="updateName">New Name</Label>
                    <Input
                      id="updateName"
                      placeholder="Updated NFT name..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="updateDescription">New Description</Label>
                    <Textarea
                      id="updateDescription"
                      placeholder="Updated description..."
                      rows={3}
                    />
                  </div>
                  
                  <Button
                    onClick={updateNFTMetadata}
                    disabled={loading || !mintedNFT}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                    ) : (
                      <>Update Metadata</>
                    )}
                  </Button>
                </TabsContent>
                ` : ''}
                
                ${hasBurn ? `
                <TabsContent value="burn" className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Burning an NFT is permanent and cannot be undone
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <Label>NFT to Burn</Label>
                    <Input
                      value={mintedNFT || ''}
                      disabled
                      placeholder="No NFT selected"
                    />
                  </div>
                  
                  <Button
                    onClick={burnNFT}
                    variant="destructive"
                    disabled={loading || !mintedNFT}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Burning...</>
                    ) : (
                      <><Flame className="mr-2 h-4 w-4" /> Burn NFT</>
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