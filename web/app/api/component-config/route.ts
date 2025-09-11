import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Get the actual working directory (should be /usr/src/PROJECT_NAME/web)
    const cwd = process.cwd();
    console.log('[component-config API] Current working directory:', cwd);
    
    // Check multiple possible locations for the config file
    const configPaths = [
      path.join(cwd, 'public', 'config', 'component-manifest.json'),
      path.join(cwd, '..', 'web', 'public', 'config', 'component-manifest.json'),
      path.join(cwd, 'component-manifest.json'),
      path.join(cwd, '.next', 'component-manifest.json'),
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log('[component-config API] Found config at:', configPath);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Check if the component file actually exists
        if (config.componentName && config.customComponent) {
          // Try both with underscores and without
          const possibleNames = [
            config.componentName,
            config.componentName.replace(/-/g, '_'),
            config.componentName.replace(/_/g, '-')
          ];
          
          let componentFound = false;
          for (const name of possibleNames) {
            const componentPath = path.join(
              cwd, 
              'src', 
              'components', 
              'generated',
              `${name}.tsx`
            );
            
            if (fs.existsSync(componentPath)) {
              config.componentExists = true;
              config.componentPath = `/components/generated/${name}`;
              config.actualComponentName = name; // Store the actual file name
              console.log('[component-config API] Component file verified at:', componentPath);
              componentFound = true;
              break;
            }
          }
          
          if (!componentFound) {
            console.warn(`[component-config API] Component file not found for: ${config.componentName}`);
            config.componentExists = false;
          }
        }
        
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
    
    // Return proper JSON for fallback case
    console.log('[component-config API] No config found, using defaults');
    return NextResponse.json({
      componentType: 'default',
      customComponent: false,
      baseType: 'fallback',
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