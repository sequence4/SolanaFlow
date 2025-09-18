import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const projectId = process.env.APP_ID || 'unknown';
    const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
    const projectName = process.env.PROJECT_NAME || projectId;

    console.log('[program-info API] ===== Program Info Request =====');
    console.log('[program-info API] Project ID:', projectId);
    console.log('[program-info API] Project Name:', projectName);
    console.log('[program-info API] Program ID:', programId);
    console.log('[program-info API] Working directory:', process.cwd());
    
    // Check multiple possible locations for IDL files
    const idlPaths = [
      // Check public directory first (where we copy the IDL)
      path.join(process.cwd(), 'public', 'idl'),
      // Check project target directories
      path.join(process.cwd(), '..', 'target', 'idl'),
      path.join(process.cwd(), '..', 'target', 'deploy'),
      path.join('/usr/src', projectName, 'target', 'idl'),
      path.join('/usr/src', projectName, 'target', 'deploy'),
      // Add paths with underscore conversion
      path.join('/usr/src', projectName.replace(/-/g, '_'), 'target', 'idl'),
      path.join('/usr/src', projectName.replace(/-/g, '_'), 'target', 'deploy'),
      // Check the actual project directory with hash
      path.join('/usr/src', `${projectName}-${projectId.slice(-8)}`, 'target', 'idl'),
      path.join('/usr/src', `${projectName}-${projectId.slice(-8)}`, 'target', 'deploy'),
      // Check web directory locations
      path.join('/usr/src', projectName, 'web', 'public', 'idl'),
      path.join('/usr/src', `${projectName}-${projectId.slice(-8)}`, 'web', 'public', 'idl'),
    ];

    console.log('[program-info API] Will check these IDL locations:', idlPaths);
    
    let idl = null;
    let idls = [];
    
    // Search for IDL files
    for (const idlDir of idlPaths) {
      try {
        if (fs.existsSync(idlDir)) {
          console.log('[program-info API] Directory exists:', idlDir);
          const files = fs.readdirSync(idlDir);
          console.log('[program-info API] Files in directory:', files);
          const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('-keypair.json'));
          console.log('[program-info API] JSON files found:', jsonFiles);
        
        for (const file of jsonFiles) {
          try {
            const content = fs.readFileSync(path.join(idlDir, file), 'utf-8');
            const parsedIdl = JSON.parse(content);
            
            // Add metadata if missing
            if (parsedIdl && !parsedIdl.metadata?.address && programId) {
              parsedIdl.metadata = {
                ...parsedIdl.metadata,
                address: programId
              };
            }
            
            idls.push(parsedIdl);
            
            // Use the first IDL as primary
            if (!idl) {
              idl = parsedIdl;
              console.log('[program-info API] Found primary IDL:', file);
            }
          } catch (error) {
            console.error(`[program-info API] Failed to parse IDL file ${file}:`, error);
          }
        }
      } catch (dirError) {
        console.log(`[program-info API] Could not access directory ${idlDir}:`, dirError);
      }
    }
    
    if (!idl) {
      console.log('[program-info API] ===== IDL NOT FOUND =====');
      console.log('[program-info API] No IDL found after checking all locations');
      console.log('[program-info API] Total IDLs collected:', idls.length);
      
      // Create a minimal fallback IDL if we have a program ID
      if (programId) {
        console.log('[program-info API] Creating fallback IDL for program:', programId);
        const projectName = process.env.PROJECT_NAME || projectId.replace(/-/g, '_');
        idl = {
          version: "0.1.0",
          name: projectName,
          instructions: [{
            name: "initialize",
            accounts: [],
            args: []
          }],
          accounts: [],
          types: [],
          errors: [],
          metadata: {
            address: programId
          }
        };
      }
    }
    
    // Log final response
    console.log('[program-info API] ===== Response Summary =====');
    console.log('[program-info API] Has IDL:', !!idl);
    console.log('[program-info API] IDL name:', idl?.name);
    console.log('[program-info API] IDL version:', idl?.version);
    console.log('[program-info API] IDL instructions:', idl?.instructions?.length || 0);
    console.log('[program-info API] Total IDLs:', idls.length);

    // Return program information
    return NextResponse.json({
      projectId,
      programId: programId || null,
      idl: idl || null,
      idls: idls.length > 0 ? idls : [],
      hasIdl: !!idl,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[program-info API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load program information',
        hasIdl: false,
        idl: null,
        idls: []
      },
      { status: 500 }
    );
  }
}