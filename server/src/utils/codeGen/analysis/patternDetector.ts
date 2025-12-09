/**
 * Pattern Detector
 * Advanced pattern detection for Solana programs
 */

import { InstructionInfo, AccountInfo } from '../templates/templateRegistry';

export interface PatternMatch {
  pattern: string;
  confidence: number;
  evidence: string[];
  recommendations: string[];
}

export interface ProgramPattern {
  type: string;
  subtype?: string;
  patterns: PatternMatch[];
  suggestedTemplates: string[];
}

export class PatternDetector {
  /**
   * Detect patterns in program instructions and accounts
   */
  detectPatterns(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): ProgramPattern {
    const patterns: PatternMatch[] = [];
    
    // Detect token patterns
    const tokenPattern = this.detectTokenPattern(instructions, accounts);
    if (tokenPattern.confidence > 0) patterns.push(tokenPattern);
    
    // Detect NFT patterns
    const nftPattern = this.detectNFTPattern(instructions, accounts);
    if (nftPattern.confidence > 0) patterns.push(nftPattern);
    
    // Detect DeFi patterns
    const defiPattern = this.detectDeFiPattern(instructions, accounts);
    if (defiPattern.confidence > 0) patterns.push(defiPattern);
    
    // Detect staking patterns
    const stakingPattern = this.detectStakingPattern(instructions, accounts);
    if (stakingPattern.confidence > 0) patterns.push(stakingPattern);
    
    // Detect governance patterns
    const governancePattern = this.detectGovernancePattern(instructions, accounts);
    if (governancePattern.confidence > 0) patterns.push(governancePattern);
    
    // Detect gaming patterns
    const gamingPattern = this.detectGamingPattern(instructions, accounts);
    if (gamingPattern.confidence > 0) patterns.push(gamingPattern);
    
    // Determine primary type
    const primaryPattern = patterns.reduce((prev, curr) => 
      curr.confidence > prev.confidence ? curr : prev,
      { pattern: 'custom', confidence: 0, evidence: [], recommendations: [] }
    );
    
    return {
      type: primaryPattern.pattern,
      subtype: this.determineSubtype(primaryPattern, instructions),
      patterns,
      suggestedTemplates: this.suggestTemplates(patterns)
    };
  }
  
  /**
   * Detect token-related patterns
   */
  private detectTokenPattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    
    // Check for token instructions
    if (instructionNames.some(n => n.includes('initialize_mint'))) {
      evidence.push('Has initialize_mint instruction');
      confidence += 30;
    }
    if (instructionNames.some(n => n.includes('mint_to'))) {
      evidence.push('Has mint_to instruction');
      confidence += 25;
    }
    if (instructionNames.some(n => n.includes('transfer'))) {
      evidence.push('Has transfer instruction');
      confidence += 20;
    }
    if (instructionNames.some(n => n.includes('burn'))) {
      evidence.push('Has burn instruction');
      confidence += 15;
    }
    if (instructionNames.some(n => n.includes('approve'))) {
      evidence.push('Has approve instruction');
      confidence += 10;
    }
    
    // Check for token accounts
    if (accountNames.some(n => n.includes('mint'))) {
      evidence.push('Has mint account');
      confidence += 20;
    }
    if (accountNames.some(n => n.includes('token_account'))) {
      evidence.push('Has token_account');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use token mint template for UI');
      recommendations.push('Include token balance display');
      recommendations.push('Add transfer functionality');
    }
    
    return {
      pattern: 'token',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Detect NFT-related patterns
   */
  private detectNFTPattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    const accountFields = accounts.flatMap(a => a.fields.map(f => f.name.toLowerCase()));
    
    // Check for NFT instructions
    if (instructionNames.some(n => n.includes('create_metadata'))) {
      evidence.push('Has create_metadata instruction');
      confidence += 35;
    }
    if (instructionNames.some(n => n.includes('update_metadata'))) {
      evidence.push('Has update_metadata instruction');
      confidence += 20;
    }
    if (instructionNames.some(n => n.includes('create_master_edition'))) {
      evidence.push('Has create_master_edition instruction');
      confidence += 30;
    }
    if (instructionNames.some(n => n.includes('verify_collection'))) {
      evidence.push('Has verify_collection instruction');
      confidence += 25;
    }
    
    // Check for NFT accounts and fields
    if (accountNames.some(n => n.includes('metadata'))) {
      evidence.push('Has metadata account');
      confidence += 25;
    }
    if (accountFields.some(f => f.includes('uri') || f.includes('image'))) {
      evidence.push('Has URI/image fields');
      confidence += 20;
    }
    if (accountFields.some(f => f.includes('attributes'))) {
      evidence.push('Has attributes field');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use NFT mint template for UI');
      recommendations.push('Include metadata editor');
      recommendations.push('Add image upload functionality');
      recommendations.push('Display NFT gallery view');
    }
    
    return {
      pattern: 'nft',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Detect DeFi-related patterns
   */
  private detectDeFiPattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    
    // Check for DeFi instructions
    if (instructionNames.some(n => n.includes('swap'))) {
      evidence.push('Has swap instruction');
      confidence += 35;
    }
    if (instructionNames.some(n => n.includes('add_liquidity'))) {
      evidence.push('Has add_liquidity instruction');
      confidence += 30;
    }
    if (instructionNames.some(n => n.includes('remove_liquidity'))) {
      evidence.push('Has remove_liquidity instruction');
      confidence += 20;
    }
    if (instructionNames.some(n => n.includes('create_pool'))) {
      evidence.push('Has create_pool instruction');
      confidence += 25;
    }
    
    // Check for DeFi accounts
    if (accountNames.some(n => n.includes('pool'))) {
      evidence.push('Has pool account');
      confidence += 20;
    }
    if (accountNames.some(n => n.includes('liquidity'))) {
      evidence.push('Has liquidity account');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use DeFi swap template for UI');
      recommendations.push('Include price charts');
      recommendations.push('Add slippage protection');
      recommendations.push('Show pool statistics');
    }
    
    return {
      pattern: 'defi',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Detect staking-related patterns
   */
  private detectStakingPattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    const accountFields = accounts.flatMap(a => a.fields.map(f => f.name.toLowerCase()));
    
    // Check for staking instructions
    if (instructionNames.some(n => n.includes('stake'))) {
      evidence.push('Has stake instruction');
      confidence += 35;
    }
    if (instructionNames.some(n => n.includes('unstake'))) {
      evidence.push('Has unstake instruction');
      confidence += 30;
    }
    if (instructionNames.some(n => n.includes('claim_reward'))) {
      evidence.push('Has claim_reward instruction');
      confidence += 25;
    }
    if (instructionNames.some(n => n.includes('compound'))) {
      evidence.push('Has compound instruction');
      confidence += 15;
    }
    
    // Check for staking accounts and fields
    if (accountNames.some(n => n.includes('stake'))) {
      evidence.push('Has stake account');
      confidence += 20;
    }
    if (accountFields.some(f => f.includes('reward') || f.includes('apr'))) {
      evidence.push('Has reward/APR fields');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use staking template for UI');
      recommendations.push('Include APR calculator');
      recommendations.push('Add rewards tracker');
      recommendations.push('Show lock periods');
    }
    
    return {
      pattern: 'staking',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Detect governance-related patterns
   */
  private detectGovernancePattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    
    // Check for governance instructions
    if (instructionNames.some(n => n.includes('create_proposal'))) {
      evidence.push('Has create_proposal instruction');
      confidence += 35;
    }
    if (instructionNames.some(n => n.includes('vote'))) {
      evidence.push('Has vote instruction');
      confidence += 30;
    }
    if (instructionNames.some(n => n.includes('execute_proposal'))) {
      evidence.push('Has execute_proposal instruction');
      confidence += 25;
    }
    if (instructionNames.some(n => n.includes('delegate'))) {
      evidence.push('Has delegate instruction');
      confidence += 15;
    }
    
    // Check for governance accounts
    if (accountNames.some(n => n.includes('proposal'))) {
      evidence.push('Has proposal account');
      confidence += 20;
    }
    if (accountNames.some(n => n.includes('governance'))) {
      evidence.push('Has governance account');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use governance template for UI');
      recommendations.push('Include proposal list');
      recommendations.push('Add voting interface');
      recommendations.push('Show voting power display');
    }
    
    return {
      pattern: 'governance',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Detect gaming-related patterns
   */
  private detectGamingPattern(
    instructions: InstructionInfo[],
    accounts: AccountInfo[]
  ): PatternMatch {
    const evidence: string[] = [];
    let confidence = 0;
    
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    const accountNames = accounts.map(a => a.name.toLowerCase());
    const accountFields = accounts.flatMap(a => a.fields.map(f => f.name.toLowerCase()));
    
    // Check for gaming instructions
    if (instructionNames.some(n => n.includes('play') || n.includes('start_game'))) {
      evidence.push('Has play/start_game instruction');
      confidence += 35;
    }
    if (instructionNames.some(n => n.includes('claim_reward') || n.includes('collect'))) {
      evidence.push('Has reward/collect instruction');
      confidence += 25;
    }
    if (instructionNames.some(n => n.includes('level_up') || n.includes('upgrade'))) {
      evidence.push('Has level_up/upgrade instruction');
      confidence += 20;
    }
    
    // Check for gaming accounts and fields
    if (accountNames.some(n => n.includes('player') || n.includes('character'))) {
      evidence.push('Has player/character account');
      confidence += 25;
    }
    if (accountFields.some(f => f.includes('score') || f.includes('points'))) {
      evidence.push('Has score/points fields');
      confidence += 20;
    }
    if (accountFields.some(f => f.includes('level') || f.includes('experience'))) {
      evidence.push('Has level/experience fields');
      confidence += 15;
    }
    
    const recommendations = [];
    if (confidence > 50) {
      recommendations.push('Use gaming template for UI');
      recommendations.push('Include leaderboard');
      recommendations.push('Add player stats display');
      recommendations.push('Show achievement system');
    }
    
    return {
      pattern: 'gaming',
      confidence: Math.min(confidence, 100),
      evidence,
      recommendations
    };
  }
  
  /**
   * Determine subtype based on pattern and instructions
   */
  private determineSubtype(pattern: PatternMatch, instructions: InstructionInfo[]): string | undefined {
    const instructionNames = instructions.map(i => i.name.toLowerCase());
    
    switch (pattern.pattern) {
      case 'token':
        if (instructionNames.some(n => n.includes('governance'))) return 'governance-token';
        if (instructionNames.some(n => n.includes('reward'))) return 'reward-token';
        if (instructionNames.some(n => n.includes('stable'))) return 'stablecoin';
        break;
        
      case 'nft':
        if (instructionNames.some(n => n.includes('game'))) return 'gaming-nft';
        if (instructionNames.some(n => n.includes('collection'))) return 'collection';
        if (instructionNames.some(n => n.includes('edition'))) return 'editions';
        break;
        
      case 'defi':
        if (instructionNames.some(n => n.includes('lend'))) return 'lending';
        if (instructionNames.some(n => n.includes('farm'))) return 'yield-farming';
        if (instructionNames.some(n => n.includes('vault'))) return 'vault';
        break;
    }
    
    return undefined;
  }
  
  /**
   * Suggest templates based on detected patterns
   */
  private suggestTemplates(patterns: PatternMatch[]): string[] {
    const templates: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.confidence > 70) {
        switch (pattern.pattern) {
          case 'token':
            templates.push('token-mint-basic');
            break;
          case 'nft':
            templates.push('nft-mint-advanced');
            break;
          case 'defi':
            templates.push('defi-swap');
            break;
          case 'staking':
            templates.push('staking');
            break;
          case 'governance':
            templates.push('governance-voting');
            break;
          case 'gaming':
            templates.push('gaming-dashboard');
            break;
        }
      }
    });
    
    // Add fallback if no strong patterns
    if (templates.length === 0) {
      templates.push('custom-basic');
    }
    
    return [...new Set(templates)]; // Remove duplicates
  }
  
  /**
   * Analyze pattern complexity
   */
  analyzeComplexity(pattern: ProgramPattern): 'simple' | 'intermediate' | 'advanced' {
    const maxConfidence = Math.max(...pattern.patterns.map(p => p.confidence));
    const patternCount = pattern.patterns.filter(p => p.confidence > 30).length;
    
    if (patternCount > 3 || maxConfidence < 50) return 'advanced';
    if (patternCount > 1 || maxConfidence < 70) return 'intermediate';
    return 'simple';
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();