/**
 * Component Generator V2
 * Enhanced version using template system for intelligent UI generation
 */

import { FileTreeItem } from "../../types/FileTreeItem";
import { Graph } from "../../types/graph";
import { TemplateRegistry, selectTemplate } from './templates/templateRegistry';
import { TokenMintTemplate } from './templates/tokenMintTemplate';
import { idlAnalyzer } from './analysis/idlAnalyzer';

// Register templates on module load
TemplateRegistry.register(TokenMintTemplate);

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
    componentCode = generateFallbackComponent(programName, programId, config);
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
  config: any
): string {
  const componentName = programName.replace(/[-_]/g, '');
  
  return `"use client"

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Wallet } from 'lucide-react'

const PROGRAM_ID = "${programId}"

export default function ${componentName}App() {
  const { publicKey, connected } = useWallet()
  const { toast } = useToast()
  
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Transaction failed",
        variant: "destructive"
      })
    }
  }
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">${config.customization?.title || programName}</h1>
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
                  <code className="text-xs bg-muted px-2 py-1 rounded">{PROGRAM_ID}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Wallet:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </code>
                </div>
                <div className="flex gap-2 mt-4">
                  <Badge variant="outline">Devnet</Badge>
                  ${config.features.map((f: string) => `<Badge variant="outline">${f}</Badge>`).join('\\n                  ')}
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
              ${config.instructions.map((ix: any) => `
              <div>
                <Button 
                  onClick={handleAction}
                  className="w-full"
                >
                  Execute ${ix.name}
                </Button>
              </div>`).join('')}
              
              {config.instructions.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No instructions detected. Please check your program configuration.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
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