/**
 * Component Generator V2
 * Enhanced version using template system for intelligent UI generation
 */

import { FileTreeItem } from "../../types/FileTreeItem";
import { Graph } from "../../types/graph";
import { TemplateRegistry, selectTemplate } from './templates/templateRegistry';
import { TokenMintTemplate } from './templates/tokenMintTemplate';
import { NFTMintTemplate } from './templates/nftMintTemplate';
import { DefiSwapTemplate } from './templates/defiSwapTemplate';
import { StakingTemplate } from './templates/stakingTemplate';
import { idlAnalyzer } from './analysis/idlAnalyzer';
import { patternDetector } from './analysis/patternDetector';

// Register all templates on module load
TemplateRegistry.register(TokenMintTemplate);
TemplateRegistry.register(NFTMintTemplate);
TemplateRegistry.register(DefiSwapTemplate);
TemplateRegistry.register(StakingTemplate);

export interface GenerateUIOptions {
  projectId: string;
  graph: Graph;
  programName: string;
  programId: string;
  idl?: any;
  customization?: {
    theme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    title?: string;
    description?: string;
  };
}

/**
 * Enhanced UI component generation using template system
 */
export async function generateUIComponents(options: GenerateUIOptions): Promise<FileTreeItem> {
  const { graph, programName, programId, idl, customization } = options;
  
  console.log(`[ComponentGeneratorV2] Starting UI generation for ${programName}`);
  
  // Analyze IDL if available
  let analysis = null;
  if (idl) {
    try {
      analysis = idlAnalyzer.analyzeIDL(idl);
      console.log(`[ComponentGeneratorV2] IDL Analysis: type=${analysis.programType}, features=${analysis.features.join(',')}`);
      
      // Use pattern detector for additional insights
      const patterns = patternDetector.detectPatterns(analysis.instructions, analysis.accounts);
      console.log(`[ComponentGeneratorV2] Pattern Detection: primary=${patterns.type}, confidence=${patterns.patterns[0]?.confidence || 0}`);
      
      // Log template suggestions
      if (patterns.suggestedTemplates.length > 0) {
        console.log(`[ComponentGeneratorV2] Suggested templates: ${patterns.suggestedTemplates.join(', ')}`);
      }
    } catch (error) {
      console.warn('[ComponentGeneratorV2] IDL analysis failed, falling back to graph analysis', error);
    }
  }
  
  // Select best template
  const { template, config } = selectTemplate(graph, idl, programName, programId);
  
  // Add customization to config
  if (customization) {
    config.customization = customization;
  }
  
  let componentCode: string;
  let templateUsed: string;
  
  if (template) {
    // Use template to generate component
    console.log(`[ComponentGeneratorV2] Using template: ${template.metadata.id}`);
    componentCode = template.generateComponent(config);
    templateUsed = template.metadata.id;
  } else {
    // Fallback to basic generation
    console.log('[ComponentGeneratorV2] No matching template, using fallback generation');
    componentCode = generateFallbackComponent(programName, programId, config, idl);
    templateUsed = 'fallback';
  }
  
  // Generate config file
  const configCode = generateConfigFile(programName, programId, templateUsed, analysis);
  
  // Create file tree
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

/**
 * Generate fallback component when no template matches
 */
function generateFallbackComponent(
  programName: string,
  programId: string,
  config: any,
  idl?: any
): string {
  const componentName = programName.replace(/[-_]/g, '');
  const instructions = config.instructions || [];
  
  return `"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// Embedded IDL
const idl = ${idl ? JSON.stringify(idl, null, 2) : 'null'};

const PROGRAM_ID = new PublicKey('${programId}');

export default function ${componentName}App() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { toast } = useToast();
  const [program, setProgram] = useState<Program | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8899', 'confirmed');
    setConnection(conn);

    if (connected && publicKey && signTransaction && idl) {
      const provider = new AnchorProvider(
        conn,
        { publicKey, signTransaction } as any,
        { commitment: 'confirmed' }
      );
      const prog = new Program(idl as any, PROGRAM_ID, provider);
      setProgram(prog);
    }
  }, [connected, publicKey, signTransaction]);

  const handleInstruction = async (instructionName: string, ...args: any[]) => {
    if (!program || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const tx = await program.methods[instructionName](...args)
        .accounts({
          // Add accounts as needed
        })
        .rpc();
      
      toast({
        title: "Transaction successful",
        description: \`Transaction ID: \${tx}\`
      });
    } catch (error: any) {
      toast({
        title: "Transaction failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">${config.customization?.title || programName.replace(/_/g, ' ')}</h1>
          <p className="text-muted-foreground mt-2">
            ${config.customization?.description || 'Solana Program Interface'}
          </p>
        </div>
        <WalletMultiButton />
      </div>
      
      {!connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground text-center mb-6">
              Connect your Solana wallet to interact with this program
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Program Information</CardTitle>
              <CardDescription>Connected to Solana program</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Program ID:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">${programId}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Wallet:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </code>
                </div>
                <div className="flex gap-2 mt-4">
                  <Badge variant="outline">Devnet</Badge>
                  ${config.features?.map((f: string) => `<Badge variant="outline">${f}</Badge>`).join('\\n                  ') || ''}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Available Actions</CardTitle>
              <CardDescription>Interact with the program</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!idl ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No IDL found. Please build your program first.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  ${instructions.map((inst: any) => `
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-4">${inst.name}</h3>
                    <Button 
                      onClick={() => handleInstruction('${inst.name}')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Execute ${inst.name}
                    </Button>
                  </div>`).join('')}
                  
                  ${instructions.length === 0 ? `
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No instructions detected. Please check your program configuration.
                    </AlertDescription>
                  </Alert>` : ''}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}`;
}

/**
 * Generate component manifest file
 */
function generateConfigFile(
  programName: string,
  programId: string,
  templateUsed: string,
  analysis: any
): string {
  return JSON.stringify({
    componentType: analysis?.programType || 'custom',
    componentName: `${programName}App`,
    customComponent: true,
    templateUsed,
    programId,
    features: analysis?.features || [],
    complexity: analysis?.complexity || 'simple',
    recommendations: analysis?.recommendations || [],
    generatedAt: new Date().toISOString(),
    version: "2.0.0"
  }, null, 2);
}

// Export for backward compatibility
export const componentGeneratorV2 = {
  generateUIComponents
};