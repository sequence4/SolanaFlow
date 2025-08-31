import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Check multiple possible locations for the config file
    const configPaths = [
      path.join(process.cwd(), 'public', 'config', 'component-manifest.json'),
      path.join(process.cwd(), 'component-manifest.json'),
      path.join(process.cwd(), '.next', 'component-manifest.json'),
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log('[component-config API] Found config at:', configPath);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Add runtime information
        const enrichedConfig = {
          ...config,
          timestamp: new Date().toISOString(),
          projectId: process.env.APP_ID || 'unknown',
          programId: process.env.NEXT_PUBLIC_PROGRAM_ID || config.programId,
        };
        
        return NextResponse.json(enrichedConfig);
      }
    }
    
    // Check if generated component exists without config file
    const generatedDir = path.join(process.cwd(), 'src', 'components', 'generated');
    if (fs.existsSync(generatedDir)) {
      const files = fs.readdirSync(generatedDir);
      const componentFile = files.find(f => f.endsWith('App.tsx') || f === 'index.tsx');
      
      if (componentFile) {
        console.log('[component-config API] Found generated component without config:', componentFile);
        return NextResponse.json({
          componentType: 'custom',
          componentName: componentFile.replace('.tsx', ''),
          customComponent: true,
          baseType: null,
          detectedFrom: 'filesystem'
        });
      }
    }
    
    // Default response when no config or generated component exists
    console.log('[component-config API] No config found, using defaults');
    return NextResponse.json({
      componentType: 'default',
      customComponent: false,
      baseType: 'token-mint',
      message: 'No custom component configuration found'
    });
    
  } catch (error) {
    console.error('[component-config API] Error:', error);
    return NextResponse.json(
      { 
        componentType: 'default',
        customComponent: false,
        error: 'Failed to load component configuration'
      },
      { status: 500 }
    );
  }
}