/**
 * Staking Template
 * Token staking and rewards management interface
 */

import { ComponentTemplate, TemplateConfig } from './templateRegistry';

export const StakingTemplate: ComponentTemplate = {
  metadata: {
    id: 'staking',
    name: 'Staking Dashboard',
    description: 'Token staking interface with rewards tracking',
    category: 'defi',
    requiredInstructions: ['stake', 'unstake'],
    optionalInstructions: ['claim_rewards', 'compound', 'get_stake_info'],
    requiredAccounts: ['stake_pool', 'stake_account'],
    complexity: 'intermediate',
    features: ['staking', 'rewards', 'apr-tracking', 'compound-interest'],
    version: '1.0.0'
  },
  
  generateComponent: (config: TemplateConfig) => {
    const { programName, programId, instructions, customization } = config;
    const componentName = programName.replace(/[-_]/g, '');
    
    // Check available features
    const hasRewards = instructions.some(i => 
      i.name.toLowerCase().includes('reward') || i.name.toLowerCase().includes('claim')
    );
    const hasCompound = instructions.some(i => 
      i.name.toLowerCase().includes('compound')
    );
    
    return `"use client"

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { 
  Loader2, TrendingUp, Coins, Clock, Gift, 
  Calculator, ArrowUp, ArrowDown, Info, DollarSign 
} from 'lucide-react'

const PROGRAM_ID = "${programId}"

export default function ${componentName}Staking() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  
  // Staking state
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [stakedBalance, setStakedBalance] = useState(0)
  const [walletBalance, setWalletBalance] = useState(1000) // Mock balance
  const [pendingRewards, setPendingRewards] = useState(0)
  const [totalRewardsClaimed, setTotalRewardsClaimed] = useState(0)
  
  // Pool state
  const [apr, setApr] = useState(12.5)
  const [totalStaked, setTotalStaked] = useState(1000000)
  const [lockPeriod, setLockPeriod] = useState(7) // days
  const [timeRemaining, setTimeRemaining] = useState(0)
  
  // Calculate estimated rewards
  const calculateEstimatedRewards = (amount: string, days: number = 30) => {
    if (!amount || isNaN(parseFloat(amount))) return 0
    const principal = parseFloat(amount)
    const rate = apr / 100 / 365
    return principal * rate * days
  }
  
  // Update pending rewards periodically
  useEffect(() => {
    if (stakedBalance > 0) {
      const interval = setInterval(() => {
        // Mock reward calculation - in production, fetch from program
        const dailyRate = apr / 100 / 365
        const rewardsPerSecond = (stakedBalance * dailyRate) / 86400
        setPendingRewards(prev => prev + rewardsPerSecond)
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [stakedBalance, apr])
  
  const handleStake = async () => {
    if (!publicKey || !stakeAmount) {
      toast({
        title: "Missing information",
        description: "Please enter amount to stake",
        variant: "destructive"
      })
      return
    }
    
    const amount = parseFloat(stakeAmount)
    if (amount > walletBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough tokens to stake",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual staking transaction
      setStakedBalance(prev => prev + amount)
      setWalletBalance(prev => prev - amount)
      setTimeRemaining(lockPeriod * 24 * 60 * 60) // Convert days to seconds
      
      toast({
        title: "Staking Successful",
        description: \`Staked \${amount} tokens successfully\`,
      })
      setStakeAmount('')
    } catch (error: any) {
      toast({
        title: "Staking Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleUnstake = async () => {
    if (!publicKey || !unstakeAmount) {
      toast({
        title: "Missing information",
        description: "Please enter amount to unstake",
        variant: "destructive"
      })
      return
    }
    
    const amount = parseFloat(unstakeAmount)
    if (amount > stakedBalance) {
      toast({
        title: "Insufficient staked balance",
        description: "You don't have enough staked tokens",
        variant: "destructive"
      })
      return
    }
    
    if (timeRemaining > 0) {
      toast({
        title: "Tokens still locked",
        description: \`Please wait \${Math.ceil(timeRemaining / 86400)} more days\`,
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual unstaking transaction
      setStakedBalance(prev => prev - amount)
      setWalletBalance(prev => prev + amount)
      
      toast({
        title: "Unstaking Successful",
        description: \`Unstaked \${amount} tokens successfully\`,
      })
      setUnstakeAmount('')
    } catch (error: any) {
      toast({
        title: "Unstaking Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleClaimRewards = async () => {
    if (!publicKey || pendingRewards === 0) {
      toast({
        title: "No rewards to claim",
        description: "You don't have any pending rewards",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual reward claiming
      setWalletBalance(prev => prev + pendingRewards)
      setTotalRewardsClaimed(prev => prev + pendingRewards)
      const claimed = pendingRewards.toFixed(4)
      setPendingRewards(0)
      
      toast({
        title: "Rewards Claimed",
        description: \`Successfully claimed \${claimed} tokens\`,
      })
    } catch (error: any) {
      toast({
        title: "Claim Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  ${hasCompound ? `
  const handleCompound = async () => {
    if (!publicKey || pendingRewards === 0) {
      toast({
        title: "No rewards to compound",
        description: "You don't have any pending rewards",
        variant: "destructive"
      })
      return
    }
    
    setLoading(true)
    try {
      // TODO: Implement actual compounding
      setStakedBalance(prev => prev + pendingRewards)
      const compounded = pendingRewards.toFixed(4)
      setPendingRewards(0)
      
      toast({
        title: "Rewards Compounded",
        description: \`Successfully compounded \${compounded} tokens\`,
      })
    } catch (error: any) {
      toast({
        title: "Compound Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  ` : ''}
  
  // Update lock timer
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [timeRemaining])
  
  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return \`\${days}d \${hours}h\`
    if (hours > 0) return \`\${hours}h \${minutes}m\`
    return \`\${minutes}m\`
  }
  
  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">${customization?.title || 'Staking Dashboard'}</h1>
          <p className="text-muted-foreground mt-2">
            ${customization?.description || 'Stake tokens and earn rewards'}
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
              Connect your wallet to start staking
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Stake</p>
                    <p className="text-2xl font-bold">{stakedBalance.toFixed(2)}</p>
                  </div>
                  <Coins className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Rewards</p>
                    <p className="text-2xl font-bold">{pendingRewards.toFixed(4)}</p>
                  </div>
                  <Gift className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current APR</p>
                    <p className="text-2xl font-bold">{apr}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Staked</p>
                    <p className="text-2xl font-bold">\${(totalStaked / 1000).toFixed(0)}K</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Main Content */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Staking Card */}
            <Card>
              <CardHeader>
                <CardTitle>Stake Your Tokens</CardTitle>
                <CardDescription>
                  Lock your tokens to earn rewards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="stake">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stake">Stake</TabsTrigger>
                    <TabsTrigger value="unstake">Unstake</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="stake" className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Amount to Stake</Label>
                        <span className="text-sm text-muted-foreground">
                          Balance: {walletBalance.toFixed(2)}
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.00"
                        max={walletBalance}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStakeAmount((walletBalance * 0.25).toFixed(2))}
                        >
                          25%
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStakeAmount((walletBalance * 0.5).toFixed(2))}
                        >
                          50%
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStakeAmount((walletBalance * 0.75).toFixed(2))}
                        >
                          75%
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStakeAmount(walletBalance.toFixed(2))}
                        >
                          MAX
                        </Button>
                      </div>
                    </div>
                    
                    {stakeAmount && (
                      <Alert>
                        <Calculator className="h-4 w-4" />
                        <AlertDescription>
                          Estimated monthly rewards: {calculateEstimatedRewards(stakeAmount).toFixed(4)} tokens
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        Lock period: {lockPeriod} days
                      </AlertDescription>
                    </Alert>
                    
                    <Button
                      onClick={handleStake}
                      disabled={loading || !stakeAmount}
                      className="w-full"
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Staking...</>
                      ) : (
                        <><ArrowUp className="mr-2 h-4 w-4" /> Stake Tokens</>
                      )}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="unstake" className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Amount to Unstake</Label>
                        <span className="text-sm text-muted-foreground">
                          Staked: {stakedBalance.toFixed(2)}
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="0.00"
                        max={stakedBalance}
                      />
                    </div>
                    
                    {timeRemaining > 0 && (
                      <Alert variant="destructive">
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          Tokens locked for {formatTime(timeRemaining)}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button
                      onClick={handleUnstake}
                      disabled={loading || !unstakeAmount || timeRemaining > 0}
                      variant="outline"
                      className="w-full"
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unstaking...</>
                      ) : (
                        <><ArrowDown className="mr-2 h-4 w-4" /> Unstake Tokens</>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Rewards Card */}
            <Card>
              <CardHeader>
                <CardTitle>Rewards Management</CardTitle>
                <CardDescription>
                  Claim or compound your earned rewards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pending Rewards</span>
                    <span className="font-semibold">{pendingRewards.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Claimed</span>
                    <span className="font-semibold">{totalRewardsClaimed.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Next Reward In</span>
                    <span className="font-semibold">~1 minute</span>
                  </div>
                </div>
                
                <Progress value={(pendingRewards / 10) * 100} className="h-2" />
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleClaimRewards}
                    disabled={loading || pendingRewards === 0}
                    className="flex-1"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...</>
                    ) : (
                      'Claim Rewards'
                    )}
                  </Button>
                  ${hasCompound ? `
                  <Button
                    onClick={handleCompound}
                    disabled={loading || pendingRewards === 0}
                    variant="outline"
                    className="flex-1"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compounding...</>
                    ) : (
                      'Compound'
                    )}
                  </Button>
                  ` : ''}
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    ${hasCompound ? 'Compound your rewards to increase your stake and earn more!' : 'Rewards are distributed proportionally based on your stake'}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}`
  }
}