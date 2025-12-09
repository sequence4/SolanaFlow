/**
 * DeFi Swap Template
 * Token swapping interface for DEX programs
 */

import { ComponentTemplate, TemplateConfig } from './templateRegistry';

export const DefiSwapTemplate: ComponentTemplate = {
  metadata: {
    id: 'defi-swap',
    name: 'DeFi Swap Interface',
    description: 'Token swapping interface for decentralized exchanges',
    category: 'defi',
    requiredInstructions: ['swap', 'add_liquidity'],
    optionalInstructions: ['remove_liquidity', 'create_pool', 'get_price'],
    requiredAccounts: ['pool', 'token_a', 'token_b'],
    complexity: 'advanced',
    features: ['swapping', 'liquidity', 'price-discovery', 'slippage-protection'],
    version: '1.0.0'
  },
  
  generateComponent: (config: TemplateConfig) => {
    const { programName, programId, instructions, customization } = config;
    const componentName = programName.replace(/[-_]/g, '');
    
    // Check available features
    const hasLiquidity = instructions.some(i => 
      i.name.toLowerCase().includes('liquidity')
    );
    const hasCreatePool = instructions.some(i => 
      i.name.toLowerCase().includes('create_pool')
    );
    
    return `"use client"

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { ArrowDownUp, Loader2, Plus, Minus, Settings, Info, TrendingUp, Droplets } from 'lucide-react'

const PROGRAM_ID = "${programId}"

// Mock token list - in production, fetch from registry
const TOKENS = [
  { symbol: 'SOL', name: 'Solana', mint: '11111111111111111111111111111111', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
]

export default function ${componentName}DefiSwap() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  // Swap state
  const [fromToken, setFromToken] = useState(TOKENS[0])
  const [toToken, setToToken] = useState(TOKENS[1])
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [exchangeRate, setExchangeRate] = useState(0)
  
  // Liquidity state
  const [tokenA, setTokenA] = useState(TOKENS[0])
  const [tokenB, setTokenB] = useState(TOKENS[1])
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [poolShare, setPoolShare] = useState(0)
  
  // Calculate output amount
  useEffect(() => {
    if (fromAmount && exchangeRate) {
      const output = parseFloat(fromAmount) * exchangeRate
      setToAmount(output.toFixed(6))
    }
  }, [fromAmount, exchangeRate])
  
  // Fetch exchange rate
  useEffect(() => {
    // Mock exchange rate - in production, fetch from program
    setExchangeRate(fromToken.symbol === 'SOL' ? 150 : 1)
  }, [fromToken, toToken])
  
  const handleSwap = async () => {
    if (!publicKey || !fromAmount) {
      toast({
        title: "Missing information",
        description: "Please connect wallet and enter amount",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual swap transaction
      toast({
        title: "Swap Successful",
        description: \`Swapped \${fromAmount} \${fromToken.symbol} for \${toAmount} \${toToken.symbol}\`,
      })
      setFromAmount('')
      setToAmount('')
    } catch (error: any) {
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleAddLiquidity = async () => {
    if (!publicKey || !amountA || !amountB) {
      toast({
        title: "Missing information",
        description: "Please enter amounts for both tokens",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual liquidity addition
      toast({
        title: "Liquidity Added",
        description: \`Added \${amountA} \${tokenA.symbol} and \${amountB} \${tokenB.symbol} to pool\`,
      })
      setAmountA('')
      setAmountB('')
    } catch (error: any) {
      toast({
        title: "Failed to Add Liquidity",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }
  
  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">${customization?.title || 'DeFi Swap'}</h1>
          <p className="text-muted-foreground mt-2">
            ${customization?.description || 'Swap tokens and provide liquidity'}
          </p>
        </div>
        <WalletMultiButton />
      </div>
      
      {!connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowDownUp className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground text-center mb-6">
              Connect your wallet to start swapping tokens
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Stats Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Pool Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Total Value Locked</Label>
                <p className="text-2xl font-bold">$1,234,567</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">24h Volume</Label>
                <p className="text-xl font-semibold">$456,789</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Your Pool Share</Label>
                <p className="text-lg">{poolShare.toFixed(2)}%</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">APY 12.5%</Badge>
                <Badge variant="outline">Low Fees</Badge>
              </div>
            </CardContent>
          </Card>
          
          {/* Swap/Liquidity Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Exchange</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="swap">
                <TabsList className="grid w-full grid-cols-${hasLiquidity ? '2' : '1'}">
                  <TabsTrigger value="swap">Swap</TabsTrigger>
                  ${hasLiquidity ? '<TabsTrigger value="liquidity">Liquidity</TabsTrigger>' : ''}
                </TabsList>
                
                <TabsContent value="swap" className="space-y-4">
                  {/* From Token */}
                  <div className="space-y-2">
                    <Label>From</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <Select
                        value={fromToken.symbol}
                        onValueChange={(v) => setFromToken(TOKENS.find(t => t.symbol === v) || TOKENS[0])}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOKENS.map(token => (
                            <SelectItem key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={switchTokens}
                      className="rounded-full"
                    >
                      <ArrowDownUp className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* To Token */}
                  <div className="space-y-2">
                    <Label>To (estimated)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={toAmount}
                        readOnly
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <Select
                        value={toToken.symbol}
                        onValueChange={(v) => setToToken(TOKENS.find(t => t.symbol === v) || TOKENS[1])}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOKENS.map(token => (
                            <SelectItem key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Slippage Settings */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Slippage Tolerance
                      </Label>
                      <span className="text-sm font-medium">{slippage}%</span>
                    </div>
                    <Slider
                      value={[slippage]}
                      onValueChange={([v]) => setSlippage(v)}
                      min={0.1}
                      max={5}
                      step={0.1}
                    />
                  </div>
                  
                  {/* Exchange Info */}
                  {exchangeRate > 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
                        <br />
                        Price impact: &lt;0.01%
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button
                    onClick={handleSwap}
                    disabled={loading || !fromAmount}
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Swapping...</>
                    ) : (
                      'Swap Tokens'
                    )}
                  </Button>
                </TabsContent>
                
                ${hasLiquidity ? `
                <TabsContent value="liquidity" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Token A</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={amountA}
                        onChange={(e) => setAmountA(e.target.value)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <Select
                        value={tokenA.symbol}
                        onValueChange={(v) => setTokenA(TOKENS.find(t => t.symbol === v) || TOKENS[0])}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOKENS.map(token => (
                            <SelectItem key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Token B</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={amountB}
                        onChange={(e) => setAmountB(e.target.value)}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <Select
                        value={tokenB.symbol}
                        onValueChange={(v) => setTokenB(TOKENS.find(t => t.symbol === v) || TOKENS[1])}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOKENS.map(token => (
                            <SelectItem key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Alert>
                    <Droplets className="h-4 w-4" />
                    <AlertDescription>
                      You will receive LP tokens representing your share of the pool
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddLiquidity}
                      disabled={loading || !amountA || !amountB}
                      className="flex-1"
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                      ) : (
                        'Add Liquidity'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={loading || poolShare === 0}
                      className="flex-1"
                    >
                      <Minus className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </TabsContent>
                ` : ''}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}`
  }
}