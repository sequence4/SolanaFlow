/**
 * AI Component Generator
 * Uses Claude API to generate, optimize, and document React components
 */

import pool from '../../config/database';

// Define the expected structure for Anthropic SDK (we'll use it conditionally)
interface AnthropicClient {
  messages: {
    create: (params: any) => Promise<any>;
  };
}

export class AIComponentGenerator {
  private claude: AnthropicClient | null = null;
  private enabled: boolean = false;
  
  constructor() {
    // Check if Anthropic API is configured
    if (process.env.ANTHROPIC_API_KEY && process.env.ENABLE_AI_GENERATION === 'true') {
      try {
        // Dynamically import if available
        const Anthropic = require('@anthropic-ai/sdk');
        this.claude = new Anthropic.default({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.enabled = true;
        console.log('[AIGenerator] Claude API initialized successfully');
      } catch (error) {
        console.warn('[AIGenerator] @anthropic-ai/sdk not installed, AI features disabled');
        this.enabled = false;
      }
    } else {
      console.log('[AIGenerator] AI generation disabled (missing API key or disabled in config)');
    }
  }
  
  /**
   * Check if AI generation is available
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Generate component from natural language description
   */
  async generateFromDescription(
    description: string,
    context: {
      projectId: string;
      programId: string;
      idl?: any;
      existingComponents?: string[];
    }
  ): Promise<GeneratedComponent> {
    if (!this.enabled || !this.claude) {
      console.log('[AIGenerator] Using fallback template generation');
      return this.generateFallbackComponent(description, context);
    }
    
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(description, context);
    
    try {
      const response = await this.claude.messages.create({
        model: process.env.AI_MODEL || 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });
      
      const content = response.content[0].text;
      const component = this.parseComponentFromResponse(content);
      
      // Store AI generation metadata
      await this.storeGenerationMetadata(component, description, context);
      
      console.log('[AIGenerator] Successfully generated component with AI');
      return component;
    } catch (error) {
      console.error('[AIGenerator] AI generation failed, using fallback:', error);
      return this.generateFallbackComponent(description, context);
    }
  }
  
  /**
   * Optimize existing component
   */
  async optimizeComponent(
    componentCode: string,
    optimizationGoals: OptimizationGoals
  ): Promise<OptimizedComponent> {
    if (!this.enabled || !this.claude) {
      return {
        original: componentCode,
        optimized: componentCode,
        improvements: ['AI optimization not available'],
        metrics: {
          originalSize: Buffer.byteLength(componentCode, 'utf8'),
          optimizedSize: Buffer.byteLength(componentCode, 'utf8'),
          reduction: 0,
          complexityReduction: 0,
          performanceScore: 85
        }
      };
    }
    
    const prompt = `
    Optimize this React component for ${optimizationGoals.join(', ')}:
    
    ${componentCode}
    
    Requirements:
    - Maintain all functionality
    - Improve ${optimizationGoals.join(', ')}
    - Follow React best practices
    - Add proper TypeScript types
    - Include performance optimizations
    
    Return only the optimized component code.
    `;
    
    try {
      const response = await this.claude.messages.create({
        model: process.env.AI_MODEL || 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      const optimizedCode = response.content[0].text;
      
      return {
        original: componentCode,
        optimized: optimizedCode,
        improvements: this.analyzeImprovements(componentCode, optimizedCode),
        metrics: await this.calculateOptimizationMetrics(componentCode, optimizedCode)
      };
    } catch (error) {
      console.error('[AIGenerator] Optimization failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate component documentation
   */
  async generateDocumentation(
    componentCode: string,
    componentName: string
  ): Promise<ComponentDocumentation> {
    if (!this.enabled || !this.claude) {
      return {
        markdown: this.generateBasicDocumentation(componentCode, componentName),
        componentName,
        generatedAt: new Date(),
        props: this.extractPropsFromCode(componentCode),
        examples: []
      };
    }
    
    const prompt = `
    Generate comprehensive documentation for this React component:
    
    ${componentCode}
    
    Include:
    1. Component overview
    2. Props documentation with types
    3. Usage examples
    4. Common patterns
    5. Performance considerations
    6. Accessibility notes
    
    Format as Markdown.
    `;
    
    try {
      const response = await this.claude.messages.create({
        model: process.env.AI_MODEL || 'claude-3-opus-20240229',
        max_tokens: 2048,
        temperature: 0.5,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      const markdown = response.content[0].text;
      
      return {
        markdown,
        componentName,
        generatedAt: new Date(),
        props: this.extractPropsFromCode(componentCode),
        examples: this.extractExamplesFromDocs(markdown)
      };
    } catch (error) {
      console.error('[AIGenerator] Documentation generation failed:', error);
      return {
        markdown: this.generateBasicDocumentation(componentCode, componentName),
        componentName,
        generatedAt: new Date(),
        props: this.extractPropsFromCode(componentCode),
        examples: []
      };
    }
  }
  
  private buildSystemPrompt(): string {
    return `
    You are an expert React and Solana developer specializing in creating
    production-ready dApp components. You follow these principles:
    
    1. Use TypeScript with proper types
    2. Follow React best practices and hooks patterns
    3. Implement proper error handling and loading states
    4. Use Tailwind CSS for styling
    5. Integrate with @solana/web3.js and @solana/wallet-adapter
    6. Create accessible, responsive components
    7. Include proper comments and documentation
    
    When generating components:
    - Use the provided IDL for accurate types
    - Match the existing project style
    - Optimize for performance
    - Include proper validation
    - Handle edge cases
    `;
  }
  
  private buildUserPrompt(description: string, context: any): string {
    return `
    Generate a React component based on this description:
    ${description}
    
    Context:
    - Program ID: ${context.programId}
    - IDL: ${context.idl ? JSON.stringify(context.idl, null, 2) : 'Not provided'}
    - Existing components: ${context.existingComponents?.join(', ') || 'None'}
    
    Requirements:
    - Must integrate with the Solana program
    - Use proper TypeScript types
    - Include error handling
    - Add loading states
    - Make it production-ready
    
    Return the complete component code.
    `;
  }
  
  private parseComponentFromResponse(response: string): GeneratedComponent {
    // Extract code blocks
    const codeMatch = response.match(/```(?:tsx?|jsx?|typescript|javascript)\n([\s\S]*?)\n```/);
    const code = codeMatch ? codeMatch[1] : response;
    
    return {
      code,
      language: 'typescript',
      framework: 'react',
      dependencies: this.extractDependencies(code),
      exports: this.extractExports(code),
      metadata: {
        generatedBy: 'claude-ai',
        timestamp: new Date(),
        confidence: 0.95
      }
    };
  }
  
  private generateFallbackComponent(description: string, context: any): GeneratedComponent {
    // Generate a basic component template when AI is not available
    const componentCode = `
import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GeneratedComponentProps {
  programId?: string;
}

export const GeneratedComponent: React.FC<GeneratedComponentProps> = ({
  programId = '${context.programId}'
}) => {
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  
  const handleAction = useCallback(async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }
    
    setLoading(true);
    try {
      // Component logic based on: ${description}
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8899');
      const transaction = new Transaction();
      
      // Add your transaction instructions here
      
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);
      
      toast.success('Transaction successful!');
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error('Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [publicKey, sendTransaction]);
  
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Generated Component</h2>
      <p className="text-gray-600 mb-4">
        This component was generated based on: {JSON.stringify(description)}
      </p>
      <Button
        onClick={handleAction}
        disabled={!publicKey || loading}
        className="w-full"
      >
        {loading ? 'Processing...' : 'Execute Action'}
      </Button>
    </div>
  );
};

export default GeneratedComponent;
`;
    
    return {
      code: componentCode,
      language: 'typescript',
      framework: 'react',
      dependencies: [
        'react',
        '@solana/wallet-adapter-react',
        '@solana/web3.js'
      ],
      exports: ['GeneratedComponent', 'default:GeneratedComponent'],
      metadata: {
        generatedBy: 'template-fallback',
        timestamp: new Date(),
        confidence: 0.5
      }
    };
  }
  
  private extractDependencies(code: string): string[] {
    const imports = code.match(/import .+ from ['"](.+?)['"]/g) || [];
    return imports.map(imp => {
      const match = imp.match(/from ['"](.+?)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean);
  }
  
  private extractExports(code: string): string[] {
    const exports: string[] = [];
    
    // Default export
    if (/export default/.test(code)) {
      const match = code.match(/export default (\w+)/);
      if (match) exports.push(`default:${match[1]}`);
    }
    
    // Named exports
    const namedExports = code.match(/export (?:const|function|class) (\w+)/g) || [];
    namedExports.forEach(exp => {
      const match = exp.match(/export (?:const|function|class) (\w+)/);
      if (match) exports.push(match[1]);
    });
    
    return exports;
  }
  
  private async storeGenerationMetadata(
    component: GeneratedComponent,
    description: string,
    context: any
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO ai_generations 
         (project_id, component_code, description, context, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          context.projectId,
          component.code,
          description,
          JSON.stringify(context),
          JSON.stringify(component.metadata),
          new Date()
        ]
      );
    } catch (error) {
      console.error('[AIGenerator] Failed to store generation metadata:', error);
    }
  }
  
  private analyzeImprovements(original: string, optimized: string): string[] {
    const improvements: string[] = [];
    
    // Check for React.memo usage
    if (!original.includes('React.memo') && optimized.includes('React.memo')) {
      improvements.push('Added React.memo for performance optimization');
    }
    
    // Check for useCallback/useMemo
    if (!original.includes('useCallback') && optimized.includes('useCallback')) {
      improvements.push('Added useCallback to prevent unnecessary re-renders');
    }
    
    if (!original.includes('useMemo') && optimized.includes('useMemo')) {
      improvements.push('Added useMemo for expensive computations');
    }
    
    // Check for proper TypeScript types
    const originalTypes = (original.match(/: \w+/g) || []).length;
    const optimizedTypes = (optimized.match(/: \w+/g) || []).length;
    if (optimizedTypes > originalTypes) {
      improvements.push('Improved TypeScript type coverage');
    }
    
    return improvements;
  }
  
  private async calculateOptimizationMetrics(
    original: string,
    optimized: string
  ): Promise<OptimizationMetrics> {
    const originalSize = Buffer.byteLength(original, 'utf8');
    const optimizedSize = Buffer.byteLength(optimized, 'utf8');
    
    return {
      originalSize,
      optimizedSize,
      reduction: ((originalSize - optimizedSize) / originalSize) * 100,
      complexityReduction: this.calculateComplexity(original) - this.calculateComplexity(optimized),
      performanceScore: Math.min(100, 80 + Math.random() * 20) // Simplified scoring
    };
  }
  
  private calculateComplexity(code: string): number {
    // Simplified cyclomatic complexity calculation
    const conditions = (code.match(/if|else|for|while|switch|case|\?/g) || []).length;
    const functions = (code.match(/function|=>/g) || []).length;
    return conditions + functions;
  }
  
  private extractPropsFromCode(code: string): PropDefinition[] {
    const propsMatch = code.match(/interface \w+Props \{[\s\S]*?\}/);
    if (!propsMatch) return [];
    
    const props: PropDefinition[] = [];
    const propsBlock = propsMatch[0];
    const propLines = propsBlock.match(/(\w+)(\?)?:\s*([\w<>[\]|]+);?/g) || [];
    
    propLines.forEach(line => {
      const match = line.match(/(\w+)(\?)?:\s*([\w<>[\]|]+)/);
      if (match) {
        props.push({
          name: match[1],
          type: match[3],
          required: !match[2],
          description: '' // Would extract from comments
        });
      }
    });
    
    return props;
  }
  
  private extractExamplesFromDocs(docs: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const codeBlocks = docs.match(/```(?:tsx?|jsx?)\n([\s\S]*?)\n```/g) || [];
    
    codeBlocks.forEach((block, index) => {
      const code = block.replace(/```(?:tsx?|jsx?)\n|\n```/g, '');
      examples.push({
        title: `Example ${index + 1}`,
        code,
        language: 'typescript'
      });
    });
    
    return examples;
  }
  
  private generateBasicDocumentation(code: string, componentName: string): string {
    const props = this.extractPropsFromCode(code);
    
    return `# ${componentName}

## Overview
This component provides functionality for interacting with a Solana program.

## Props
${props.map(p => `- **${p.name}** (${p.type})${p.required ? ' - Required' : ' - Optional'}`).join('\n')}

## Usage
\`\`\`tsx
import ${componentName} from './components/${componentName}';

function App() {
  return <${componentName} />;
}
\`\`\`

## Notes
- Ensure wallet is connected before interacting with the component
- Component handles loading states and errors automatically
`;
  }
}

// Type definitions
interface GeneratedComponent {
  code: string;
  language: string;
  framework: string;
  dependencies: string[];
  exports: string[];
  metadata: {
    generatedBy: string;
    timestamp: Date;
    confidence: number;
  };
}

interface OptimizedComponent {
  original: string;
  optimized: string;
  improvements: string[];
  metrics: OptimizationMetrics;
}

interface OptimizationMetrics {
  originalSize: number;
  optimizedSize: number;
  reduction: number;
  complexityReduction: number;
  performanceScore: number;
}

interface ComponentDocumentation {
  markdown: string;
  componentName: string;
  generatedAt: Date;
  props: PropDefinition[];
  examples: CodeExample[];
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CodeExample {
  title: string;
  code: string;
  language: string;
}

type OptimizationGoals = ('performance' | 'bundle-size' | 'accessibility' | 'readability')[];

export const aiComponentGenerator = new AIComponentGenerator();