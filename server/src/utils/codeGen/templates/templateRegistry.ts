/**
 * Template Registry System
 * Manages reusable UI templates for different Solana program patterns
 */

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'token' | 'nft' | 'defi' | 'governance' | 'gaming' | 'custom';
  requiredInstructions: string[];
  optionalInstructions: string[];
  requiredAccounts: string[];
  complexity: 'simple' | 'intermediate' | 'advanced';
  features: string[];
  version: string;
}

export interface ComponentTemplate {
  metadata: TemplateMetadata;
  generateComponent: (config: TemplateConfig) => string;
  generateStyles?: (config: TemplateConfig) => string;
  generateUtils?: (config: TemplateConfig) => string;
  generateHooks?: (config: TemplateConfig) => string;
}

export interface TemplateConfig {
  programName: string;
  programId: string;
  instructions: InstructionInfo[];
  accounts: AccountInfo[];
  state?: StateInfo[];
  idl?: any;
  features: string[];
  customization?: {
    theme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    logo?: string;
    title?: string;
    description?: string;
  };
}

export interface InstructionInfo {
  name: string;
  args: Array<{
    name: string;
    type: string;
  }>;
  accounts: Array<{
    name: string;
    isMut: boolean;
    isSigner: boolean;
  }>;
}

export interface AccountInfo {
  name: string;
  type: string;
  fields: Array<{
    name: string;
    type: string;
  }>;
}

export interface StateInfo {
  name: string;
  fields: Array<{
    name: string;
    type: string;
  }>;
}

/**
 * Template Registry Class
 * Singleton pattern for managing component templates
 */
class TemplateRegistryClass {
  private templates: Map<string, ComponentTemplate> = new Map();
  private static instance: TemplateRegistryClass;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): TemplateRegistryClass {
    if (!TemplateRegistryClass.instance) {
      TemplateRegistryClass.instance = new TemplateRegistryClass();
    }
    return TemplateRegistryClass.instance;
  }
  
  /**
   * Register a new template
   */
  register(template: ComponentTemplate): void {
    this.templates.set(template.metadata.id, template);
    console.log(`[TemplateRegistry] Registered template: ${template.metadata.id} v${template.metadata.version}`);
  }
  
  /**
   * Get template by ID
   */
  get(id: string): ComponentTemplate | undefined {
    return this.templates.get(id);
  }
  
  /**
   * Find the best matching template for given configuration
   */
  findBestMatch(config: TemplateConfig): ComponentTemplate | null {
    let bestMatch: ComponentTemplate | null = null;
    let bestScore = 0;
    
    const instructionNames = config.instructions.map(i => i.name.toLowerCase());
    
    for (const template of this.templates.values()) {
      let score = 0;
      
      // Check required instructions (must have all)
      const hasAllRequired = template.metadata.requiredInstructions.every(req =>
        instructionNames.some(name => name.includes(req.toLowerCase()))
      );
      
      if (!hasAllRequired) continue;
      
      // Base score for having all required instructions
      score += template.metadata.requiredInstructions.length * 10;
      
      // Bonus points for optional instructions
      template.metadata.optionalInstructions.forEach(opt => {
        if (instructionNames.some(name => name.includes(opt.toLowerCase()))) {
          score += 5;
        }
      });
      
      // Bonus points for matching features
      config.features.forEach(feature => {
        if (template.metadata.features.includes(feature)) {
          score += 3;
        }
      });
      
      // Penalty for complexity mismatch
      if (config.instructions.length <= 3 && template.metadata.complexity === 'advanced') {
        score -= 5;
      }
      if (config.instructions.length > 10 && template.metadata.complexity === 'simple') {
        score -= 5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }
    
    if (bestMatch) {
      console.log(`[TemplateRegistry] Best match: ${bestMatch.metadata.id} (score: ${bestScore})`);
    } else {
      console.log(`[TemplateRegistry] No matching template found for instructions: ${instructionNames.join(', ')}`);
    }
    
    return bestMatch;
  }
  
  /**
   * Get all templates by category
   */
  getByCategory(category: string): ComponentTemplate[] {
    return Array.from(this.templates.values()).filter(
      t => t.metadata.category === category
    );
  }
  
  /**
   * Get all registered templates
   */
  getAll(): ComponentTemplate[] {
    return Array.from(this.templates.values());
  }
  
  /**
   * Clear all templates (useful for testing)
   */
  clear(): void {
    this.templates.clear();
  }
  
  /**
   * Get template count
   */
  size(): number {
    return this.templates.size;
  }
}

// Export singleton instance
export const TemplateRegistry = TemplateRegistryClass.getInstance();

/**
 * Helper function to analyze program and select best template
 */
export function selectTemplate(
  graph: any,
  idl: any,
  programName: string,
  programId: string
): { template: ComponentTemplate | null; config: TemplateConfig } {
  // Parse instructions from IDL or graph
  const instructions: InstructionInfo[] = [];
  const accounts: AccountInfo[] = [];
  const state: StateInfo[] = [];
  
  if (idl && typeof idl === 'object') {
    // Parse from IDL
    if (idl.instructions && Array.isArray(idl.instructions)) {
      idl.instructions.forEach((ix: any) => {
        instructions.push({
          name: ix.name || 'unknown',
          args: ix.args || [],
          accounts: ix.accounts || []
        });
      });
    }
    
    if (idl.accounts && Array.isArray(idl.accounts)) {
      idl.accounts.forEach((acc: any) => {
        accounts.push({
          name: acc.name || 'unknown',
          type: acc.type?.kind || 'unknown',
          fields: acc.type?.fields || []
        });
      });
    }
    
    if (idl.state) {
      state.push({
        name: 'program_state',
        fields: idl.state.struct?.fields || []
      });
    }
  } else if (graph) {
    // Parse from graph nodes (fallback)
    const instructionNodes = graph.nodes?.filter((n: any) => n.type === 'instruction') || [];
    instructionNodes.forEach((node: any) => {
      const name = node.config?.name || 'unknown';
      instructions.push({
        name,
        args: [],
        accounts: []
      });
    });
  }
  
  // Detect features based on instruction names
  const features: string[] = [];
  const instructionNames = instructions.map(i => i.name.toLowerCase());
  
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
  
  // NFT features
  if (instructionNames.some(n => n.includes('metadata'))) {
    features.push('metadata');
  }
  if (instructionNames.some(n => n.includes('collection'))) {
    features.push('collections');
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
  
  // Governance features
  if (instructionNames.some(n => n.includes('vote'))) {
    features.push('governance');
  }
  if (instructionNames.some(n => n.includes('proposal'))) {
    features.push('proposals');
  }
  
  const config: TemplateConfig = {
    programName,
    programId,
    instructions,
    accounts,
    state: state.length > 0 ? state : undefined,
    idl,
    features
  };
  
  const template = TemplateRegistry.findBestMatch(config);
  
  return { template, config };
}

/**
 * Helper to detect program type from instructions
 */
export function detectProgramType(instructions: InstructionInfo[]): string {
  const names = instructions.map(i => i.name.toLowerCase());
  
  // Check for token program
  if (names.some(n => n.includes('initialize_mint')) && 
      names.some(n => n.includes('mint_to'))) {
    return 'token';
  }
  
  // Check for NFT program
  if (names.some(n => n.includes('create_metadata')) || 
      names.some(n => n.includes('create_master_edition'))) {
    return 'nft';
  }
  
  // Check for DeFi program
  if (names.some(n => n.includes('swap')) || 
      names.some(n => n.includes('add_liquidity'))) {
    return 'defi';
  }
  
  // Check for staking program
  if (names.some(n => n.includes('stake')) && 
      names.some(n => n.includes('unstake'))) {
    return 'staking';
  }
  
  // Check for governance program
  if (names.some(n => n.includes('create_proposal')) || 
      names.some(n => n.includes('vote'))) {
    return 'governance';
  }
  
  return 'custom';
}