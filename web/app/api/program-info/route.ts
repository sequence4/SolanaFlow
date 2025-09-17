import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const projectId = process.env.APP_ID || 'unknown';
    const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
    
    console.log('[program-info API] Fetching program info for project:', projectId);
    
    // Check multiple possible locations for IDL files
    const idlPaths = [
      path.join(process.cwd(), '..', 'target', 'idl'),
      path.join(process.cwd(), '..', 'target', 'deploy'),
      path.join('/usr/src', process.env.PROJECT_NAME || projectId, 'target', 'idl'),
      path.join('/usr/src', process.env.PROJECT_NAME || projectId, 'target', 'deploy'),
    ];
    
    let idl = null;
    let idls = [];
    
    // Search for IDL files
    for (const idlDir of idlPaths) {
      if (fs.existsSync(idlDir)) {
        console.log('[program-info API] Checking IDL directory:', idlDir);
        const files = fs.readdirSync(idlDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('-keypair.json'));
        
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
      }
    }
    
    if (!idl) {
      console.log('[program-info API] No IDL found in any location');
    }
    
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