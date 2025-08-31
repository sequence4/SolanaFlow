/**
 * UI Helper Utilities
 * Common utilities for generating Solana UI components
 */

import { InstructionInfo, AccountInfo } from '../templates/templateRegistry';

/**
 * Generate form fields based on instruction arguments
 */
export function generateFormFields(instruction: InstructionInfo): string {
  return instruction.args.map(arg => {
    const fieldName = toCamelCase(arg.name);
    const label = toLabel(arg.name);
    const inputType = getInputType(arg.type);
    
    return `
    <div>
      <Label htmlFor="${fieldName}">${label}</Label>
      <Input
        id="${fieldName}"
        type="${inputType}"
        value={${fieldName}}
        onChange={(e) => set${capitalize(fieldName)}(e.target.value)}
        placeholder="${getPlaceholder(arg.type)}"
        ${getValidationProps(arg.type)}
      />
      ${getFieldHelperText(arg)}
    </div>`;
  }).join('\n');
}

/**
 * Generate state variables for instruction arguments
 */
export function generateStateVariables(instruction: InstructionInfo): string {
  return instruction.args.map(arg => {
    const fieldName = toCamelCase(arg.name);
    const defaultValue = getDefaultValue(arg.type);
    return `const [${fieldName}, set${capitalize(fieldName)}] = useState(${defaultValue})`;
  }).join('\n  ');
}

/**
 * Generate account display components
 */
export function generateAccountDisplay(account: AccountInfo): string {
  const displayFields = account.fields.filter(f => 
    !f.name.includes('bump') && !f.name.includes('reserved')
  );
  
  return `
    <Card>
      <CardHeader>
        <CardTitle>${toLabel(account.name)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        ${displayFields.map(field => `
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">${toLabel(field.name)}</span>
          <span className="font-mono text-sm">{accountData?.${toCamelCase(field.name)} || '-'}</span>
        </div>`).join('')}
      </CardContent>
    </Card>`;
}

/**
 * Generate transaction handler function
 */
export function generateTransactionHandler(instruction: InstructionInfo): string {
  const functionName = `handle${capitalize(toCamelCase(instruction.name))}`;
  const args = instruction.args.map(a => toCamelCase(a.name));
  
  return `
  const ${functionName} = async () => {
    if (!publicKey || !connection) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      })
      return
    }
    
    ${args.length > 0 ? `
    // Validate inputs
    if (${args.map(a => `!${a}`).join(' || ')}) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }
    ` : ''}
    
    setLoading(true)
    try {
      // TODO: Implement ${instruction.name} transaction
      // const ix = await program.methods.${toCamelCase(instruction.name)}(
      //   ${args.join(',\n      //   ')}
      // )
      // .accounts({
      //   ${instruction.accounts.map(a => `${toCamelCase(a.name)}: ${a.name}PublicKey`).join(',\n      //   ')}
      // })
      // .instruction()
      
      toast({
        title: "Success",
        description: "${toLabel(instruction.name)} completed successfully",
      })
      
      ${args.length > 0 ? `// Reset form
      ${args.map(a => `set${capitalize(a)}(${getDefaultValue('string')})`).join('\n      ')}` : ''}
    } catch (error: any) {
      toast({
        title: "Transaction Failed",
        description: error.message || "An error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }`;
}

/**
 * Generate wallet connection check
 */
export function generateWalletCheck(): string {
  return `
  if (!connected) {
    return (
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
    )
  }`;
}

/**
 * Generate imports based on features used
 */
export function generateImports(features: Set<string>): string {
  const imports: string[] = [
    `"use client"`,
    '',
    `import { useState, useEffect } from 'react'`,
    `import { useWallet } from '@solana/wallet-adapter-react'`,
    `import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'`,
    `import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js'`,
    `import { useConnection } from '@solana/wallet-adapter-react'`
  ];
  
  // UI components
  const uiComponents = ['Card', 'CardContent', 'CardHeader', 'CardTitle'];
  if (features.has('forms')) {
    uiComponents.push('Button', 'Input', 'Label');
  }
  if (features.has('alerts')) {
    uiComponents.push('Alert', 'AlertDescription');
  }
  if (features.has('tabs')) {
    uiComponents.push('Tabs', 'TabsContent', 'TabsList', 'TabsTrigger');
  }
  if (features.has('select')) {
    uiComponents.push('Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue');
  }
  if (features.has('badge')) {
    uiComponents.push('Badge');
  }
  if (features.has('progress')) {
    uiComponents.push('Progress');
  }
  if (features.has('slider')) {
    uiComponents.push('Slider');
  }
  
  imports.push(`import { ${uiComponents.join(', ')} } from '@/components/ui/${uiComponents[0].toLowerCase()}'`);
  
  if (features.has('toast')) {
    imports.push(`import { useToast } from '@/hooks/use-toast'`);
  }
  
  // Icons
  const icons: string[] = ['Loader2'];
  if (features.has('wallet-icon')) icons.push('Wallet');
  if (features.has('info-icon')) icons.push('Info');
  if (features.has('alert-icon')) icons.push('AlertCircle');
  
  imports.push(`import { ${icons.join(', ')} } from 'lucide-react'`);
  
  return imports.join('\n');
}

/**
 * Helper functions
 */

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getInputType(type: string): string {
  if (type.includes('u64') || type.includes('u32') || type.includes('i64')) {
    return 'number';
  }
  if (type.includes('bool')) {
    return 'checkbox';
  }
  if (type.includes('pubkey')) {
    return 'text';
  }
  return 'text';
}

function getPlaceholder(type: string): string {
  if (type.includes('u64') || type.includes('u32')) {
    return '0';
  }
  if (type.includes('pubkey')) {
    return 'Enter Solana address...';
  }
  if (type.includes('string')) {
    return 'Enter text...';
  }
  return '';
}

function getValidationProps(type: string): string {
  if (type.includes('u64') || type.includes('u32')) {
    return 'min="0"';
  }
  if (type.includes('pubkey')) {
    return 'pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"';
  }
  return '';
}

function getDefaultValue(type: string): string {
  if (type.includes('u64') || type.includes('u32') || type.includes('i64')) {
    return '0';
  }
  if (type.includes('bool')) {
    return 'false';
  }
  if (type.includes('vec')) {
    return '[]';
  }
  return "''";
}

function getFieldHelperText(arg: { name: string; type: string }): string {
  if (arg.type.includes('pubkey')) {
    return `<p className="text-xs text-muted-foreground mt-1">Enter a valid Solana address</p>`;
  }
  if (arg.type.includes('u64')) {
    return `<p className="text-xs text-muted-foreground mt-1">Enter a positive number</p>`;
  }
  return '';
}

/**
 * Generate loading states
 */
export function generateLoadingState(action: string): string {
  return `{loading ? (
    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ${action}...</>
  ) : (
    '${action}'
  )}`;
}

/**
 * Generate error handling
 */
export function generateErrorHandling(): string {
  return `
  const handleError = (error: any, action: string) => {
    console.error(\`Error during \${action}:\`, error)
    toast({
      title: \`\${action} Failed\`,
      description: error.message || 'An unexpected error occurred',
      variant: "destructive"
    })
  }`;
}

/**
 * Generate program connection setup
 */
export function generateProgramSetup(programId: string): string {
  return `
  // Program setup
  const PROGRAM_ID = new PublicKey("${programId}")
  
  // Initialize program connection
  useEffect(() => {
    if (!connection) return
    
    // TODO: Initialize Anchor program
    // const provider = new AnchorProvider(connection, wallet, {})
    // const program = new Program(IDL, PROGRAM_ID, provider)
    // setProgram(program)
  }, [connection, wallet])`;
}

/**
 * Generate component props interface
 */
export function generatePropsInterface(componentName: string): string {
  return `
interface ${componentName}Props {
  programId?: string
  theme?: 'light' | 'dark' | 'auto'
  onSuccess?: (signature: string) => void
  onError?: (error: Error) => void
}`
}

/**
 * Export all helper functions
 */
export const uiHelpers = {
  generateFormFields,
  generateStateVariables,
  generateAccountDisplay,
  generateTransactionHandler,
  generateWalletCheck,
  generateImports,
  generateLoadingState,
  generateErrorHandling,
  generateProgramSetup,
  generatePropsInterface,
  toCamelCase,
  capitalize,
  toLabel
};