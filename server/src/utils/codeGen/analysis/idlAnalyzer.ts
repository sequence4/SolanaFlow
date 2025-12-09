/**
 * IDL Analyzer
 * Analyzes Anchor IDL to understand program structure and generate appropriate UI
 */

import { InstructionInfo, AccountInfo, StateInfo } from '../templates/templateRegistry';

export interface IDLAnalysis {
  programType: 'token' | 'nft' | 'defi' | 'staking' | 'governance' | 'custom';
  instructions: InstructionInfo[];
  accounts: AccountInfo[];
  state: StateInfo[];
  features: string[];
  complexity: 'simple' | 'intermediate' | 'advanced';
  recommendations: UIRecommendation[];
}

export interface UIRecommendation {
  component: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export class IDLAnalyzer {
  /**
   * Analyze an Anchor IDL to understand program structure
   */
  analyzeIDL(idl: any): IDLAnalysis {
    const instructions = this.parseInstructions(idl);
    const accounts = this.parseAccounts(idl);
    const state = this.parseState(idl);
    const features = this.detectFeatures(instructions, accounts);
    const programType = this.detectProgramType(instructions, features);
    const complexity = this.calculateComplexity(instructions, accounts, state);
    const recommendations = this.generateRecommendations(programType, instructions, features);
    
    return {
      programType,
      instructions,
      accounts,
      state,
      features,
      complexity,
      recommendations
    };
  }
  
  /**
   * Parse instructions from IDL
   */
  private parseInstructions(idl: any): InstructionInfo[] {
    if (!idl || !idl.instructions) return [];
    
    return idl.instructions.map((ix: any) => ({
      name: ix.name || 'unknown',
      args: (ix.args || []).map((arg: any) => ({
        name: arg.name || 'unknown',
        type: this.mapType(arg.type)
      })),
      accounts: (ix.accounts || []).map((acc: any) => ({
        name: acc.name || 'unknown',
        isMut: acc.isMut || false,
        isSigner: acc.isSigner || false
      }))
    }));
  }
  
  /**
   * Parse accounts from IDL
   */
  private parseAccounts(idl: any): AccountInfo[] {
    if (!idl || !idl.accounts) return [];
    
    return idl.accounts.map((acc: any) => ({
      name: acc.name || 'unknown',
      type: acc.type?.kind || 'struct',
      fields: (acc.type?.fields || []).map((field: any) => ({
        name: field.name || 'unknown',
        type: this.mapType(field.type)
      }))
    }));
  }
  
  /**
   * Parse state from IDL
   */
  private parseState(idl: any): StateInfo[] {
    if (!idl || !idl.state) return [];
    
    const state: StateInfo[] = [];
    
    if (idl.state.struct) {
      state.push({
        name: 'program_state',
        fields: (idl.state.struct.fields || []).map((field: any) => ({
          name: field.name || 'unknown',
          type: this.mapType(field.type)
        }))
      });
    }
    
    return state;
  }
  
  /**
   * Map IDL types to simplified types
   */
  private mapType(type: any): string {
    if (typeof type === 'string') return type;
    if (typeof type === 'object') {
      if (type.option) return `Option<${this.mapType(type.option)}>`;
      if (type.vec) return `Vec<${this.mapType(type.vec)}>`;
      if (type.array) return `[${this.mapType(type.array[0])}; ${type.array[1]}]`;
      if (type.defined) return type.defined;
    }
    return 'unknown';
  }
  
  /**
   * Detect features from instructions and accounts
   */
  private detectFeatures(instructions: InstructionInfo[], accounts: AccountInfo[]): string[] {
    const features: string[] = [];
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    
    // Token features
    if (instructionNames.some(n => n.includes('mint') || n.includes('initialize_mint'))) {
      features.push('minting');
    }
    if (instructionNames.some(n => n.includes('transfer'))) {
      features.push('transfers');
    }
    if (instructionNames.some(n => n.includes('burn'))) {
      features.push('burning');
    }
    if (instructionNames.some(n => n.includes('freeze'))) {
      features.push('freezing');
    }
    if (instructionNames.some(n => n.includes('approve'))) {
      features.push('delegation');
    }
    
    // NFT features
    if (instructionNames.some(n => n.includes('metadata')) || 
        accountNames.some(n => n.includes('metadata'))) {
      features.push('metadata');
    }
    if (instructionNames.some(n => n.includes('collection'))) {
      features.push('collections');
    }
    if (instructionNames.some(n => n.includes('edition'))) {
      features.push('editions');
    }
    
    // DeFi features
    if (instructionNames.some(n => n.includes('stake'))) {
      features.push('staking');
    }
    if (instructionNames.some(n => n.includes('swap'))) {
      features.push('swapping');
    }
    if (instructionNames.some(n => n.includes('liquidity'))) {
      features.push('liquidity');
    }
    if (instructionNames.some(n => n.includes('lend') || n.includes('borrow'))) {
      features.push('lending');
    }
    
    // Governance features
    if (instructionNames.some(n => n.includes('vote'))) {
      features.push('voting');
    }
    if (instructionNames.some(n => n.includes('proposal'))) {
      features.push('proposals');
    }
    if (instructionNames.some(n => n.includes('delegate'))) {
      features.push('delegation');
    }
    
    // Gaming features
    if (instructionNames.some(n => n.includes('play') || n.includes('game'))) {
      features.push('gaming');
    }
    if (instructionNames.some(n => n.includes('reward'))) {
      features.push('rewards');
    }
    if (instructionNames.some(n => n.includes('leaderboard'))) {
      features.push('leaderboards');
    }
    
    return features;
  }
  
  /**
   * Detect program type based on instructions and features
   */
  private detectProgramType(instructions: InstructionInfo[], features: string[]): 'token' | 'nft' | 'defi' | 'staking' | 'governance' | 'custom' {
    const names = instructions.map(i => i.name.toLowerCase());
    
    // Token program detection
    if (features.includes('minting') && 
        (names.some(n => n.includes('initialize_mint')) || 
         names.some(n => n.includes('mint_to')))) {
      return 'token';
    }
    
    // NFT program detection
    if (features.includes('metadata') || 
        features.includes('collections') || 
        features.includes('editions')) {
      return 'nft';
    }
    
    // DeFi program detection
    if (features.includes('swapping') || 
        features.includes('liquidity') || 
        features.includes('lending')) {
      return 'defi';
    }
    
    // Staking program detection
    if (features.includes('staking') && 
        names.some(n => n.includes('stake')) && 
        names.some(n => n.includes('unstake'))) {
      return 'staking';
    }
    
    // Governance program detection
    if (features.includes('voting') || 
        features.includes('proposals')) {
      return 'governance';
    }
    
    return 'custom';
  }
  
  /**
   * Calculate program complexity
   */
  private calculateComplexity(
    instructions: InstructionInfo[], 
    accounts: AccountInfo[], 
    state: StateInfo[]
  ): 'simple' | 'intermediate' | 'advanced' {
    const instructionCount = instructions.length;
    const accountCount = accounts.length;
    const stateFieldCount = state.reduce((sum, s) => sum + s.fields.length, 0);
    const totalComplexity = instructionCount + accountCount + stateFieldCount;
    
    if (totalComplexity <= 10) return 'simple';
    if (totalComplexity <= 25) return 'intermediate';
    return 'advanced';
  }
  
  /**
   * Generate UI recommendations based on analysis
   */
  private generateRecommendations(
    programType: string,
    instructions: InstructionInfo[],
    features: string[]
  ): UIRecommendation[] {
    const recommendations: UIRecommendation[] = [];
    
    // Always recommend wallet connection
    recommendations.push({
      component: 'WalletConnection',
      priority: 'high',
      reason: 'Required for all blockchain interactions'
    });
    
    // Program-specific recommendations
    switch (programType) {
      case 'token':
        recommendations.push({
          component: 'TokenMintForm',
          priority: 'high',
          reason: 'Core functionality for token programs'
        });
        if (features.includes('transfers')) {
          recommendations.push({
            component: 'TokenTransferForm',
            priority: 'high',
            reason: 'Transfer functionality detected'
          });
        }
        if (features.includes('burning')) {
          recommendations.push({
            component: 'TokenBurnForm',
            priority: 'medium',
            reason: 'Burn functionality detected'
          });
        }
        break;
        
      case 'nft':
        recommendations.push({
          component: 'NFTMintForm',
          priority: 'high',
          reason: 'Core functionality for NFT programs'
        });
        if (features.includes('metadata')) {
          recommendations.push({
            component: 'MetadataEditor',
            priority: 'high',
            reason: 'Metadata management detected'
          });
        }
        if (features.includes('collections')) {
          recommendations.push({
            component: 'CollectionView',
            priority: 'medium',
            reason: 'Collection support detected'
          });
        }
        break;
        
      case 'defi':
        if (features.includes('swapping')) {
          recommendations.push({
            component: 'SwapInterface',
            priority: 'high',
            reason: 'Swap functionality detected'
          });
        }
        if (features.includes('liquidity')) {
          recommendations.push({
            component: 'LiquidityManager',
            priority: 'high',
            reason: 'Liquidity management detected'
          });
        }
        break;
        
      case 'staking':
        recommendations.push({
          component: 'StakingDashboard',
          priority: 'high',
          reason: 'Core functionality for staking programs'
        });
        if (features.includes('rewards')) {
          recommendations.push({
            component: 'RewardsTracker',
            priority: 'high',
            reason: 'Rewards system detected'
          });
        }
        break;
        
      case 'governance':
        recommendations.push({
          component: 'ProposalList',
          priority: 'high',
          reason: 'Core functionality for governance programs'
        });
        if (features.includes('voting')) {
          recommendations.push({
            component: 'VotingInterface',
            priority: 'high',
            reason: 'Voting functionality detected'
          });
        }
        break;
        
      default:
        // Generic recommendations for custom programs
        instructions.forEach(instruction => {
          recommendations.push({
            component: `${instruction.name}Form`,
            priority: 'medium',
            reason: `Form for ${instruction.name} instruction`
          });
        });
    }
    
    // Add monitoring components for complex programs
    if (instructions.length > 10) {
      recommendations.push({
        component: 'TransactionHistory',
        priority: 'low',
        reason: 'Complex program would benefit from transaction tracking'
      });
      recommendations.push({
        component: 'Analytics Dashboard',
        priority: 'low',
        reason: 'Complex program would benefit from analytics'
      });
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const idlAnalyzer = new IDLAnalyzer();