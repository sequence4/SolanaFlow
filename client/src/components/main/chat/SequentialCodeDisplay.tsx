import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

const SequentialCodeDisplay: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  // IMMEDIATE validation and logging
  console.log('[SequentialCodeDisplay] RENDER CALLED with files:', files);
  
  if (!files || files.length === 0) {
    return (
      <div className="text-gray-400 italic p-4">
        Waiting for code generation...
      </div>
    );
  }
  
  // Force re-render with valid files
  const [forceUpdate, setForceUpdate] = useState(0);
  
  useEffect(() => {
    console.log('[SequentialCodeDisplay] Files changed, forcing update');
    setForceUpdate(prev => prev + 1);
  }, [files]);
  
  // CRITICAL: Validate and fix files structure
  const validatedFiles = React.useMemo(() => {
    if (!files || !Array.isArray(files)) {
      console.error('[SequentialCodeDisplay] No files provided!');
      return [];
    }
    
    return files.map(f => {
      if (!f || typeof f !== 'object') {
        console.error('[SequentialCodeDisplay] Invalid file object:', f);
        return null;
      }
      
      // Ensure proper structure
      return {
        filename: f.filename || 'unknown.rs',
        content: f.content || '// No content available',
        language: f.language || 'rust'
      };
    }).filter(Boolean) as CodeFile[];
  }, [files, forceUpdate]);

  console.log('[SequentialCodeDisplay] Validated files:', validatedFiles.length);

  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [mounted, setMounted] = useState(false);
  const [finalFilesToDisplay, setFinalFilesToDisplay] = useState<CodeFile[]>([]);
  
  // CRITICAL DEBUG CHECK - Add this to see what's received
  useEffect(() => {
    console.error('[SequentialCodeDisplay] CRITICAL CHECK:', {
      filesReceived: validatedFiles?.length || 0,
      firstFile: validatedFiles?.[0] ? {
        filename: validatedFiles[0].filename,
        hasContent: !!validatedFiles[0].content,
        contentLength: validatedFiles[0].content?.length || 0,
        actualContent: validatedFiles[0].content?.substring(0, 100) || 'NO CONTENT AT ALL'
      } : 'NO FILES'
    });
    
    console.log('[SequentialCodeDisplay] Component mounted/updated');
    console.log('[SequentialCodeDisplay] Validated files:', validatedFiles?.length || 0);
    console.log('[SequentialCodeDisplay] Files data:', validatedFiles?.map(f => ({
      filename: f?.filename,
      hasContent: !!f?.content,
      contentLength: f?.content?.length || 0,
      contentPreview: f?.content?.substring(0, 50) || 'NO CONTENT',
      language: f?.language
    })));
  }, [validatedFiles]);
  
  // Fix hydration issues
  useEffect(() => {
    setMounted(true);
    console.log('[SequentialCodeDisplay] Mounted set to true');
  }, []);
  
  // Use validatedFiles instead of the old validFiles
  const validFiles = validatedFiles;
  
  // Get sample content for files without content
  const getSampleContent = (filename: string, language: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (extension === 'rs') {
      return `use anchor_lang::prelude::*;

#[program]
pub mod ${filename.replace('.rs', '').replace(/[^a-zA-Z0-9]/g, '_')} {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}`;
    }
    
    if (extension === 'toml') {
      return `[features]
resolution = true
skip-lint = false

[programs.localnet]
${filename.replace('.toml', '').replace(/[^a-zA-Z0-9]/g, '_')} = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"`;
    }
    
    if (extension === 'ts' || extension === 'tsx') {
      return `import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

export class ${filename.replace(/[^a-zA-Z0-9]/g, '')}Client {
  constructor(
    private program: Program,
    private provider: AnchorProvider
  ) {}
  
  async initialize() {
    return this.program.methods
      .initialize()
      .rpc();
  }
}`;
    }
    
    return `// ${filename}
// Generated file content will appear here
// File type: ${language}`;
  };
  
  // Truncate content to show only first 8-10 lines
  const getTruncatedContent = (content: string) => {
    if (!content) return '';
    const lines = content.split('\n');
    const maxLines = 8;
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '\n// ... more';
    }
    return content;
  };
  
  // Process files and create final display array
  useEffect(() => {
    console.log('[SequentialCodeDisplay] Processing files for display');
    
    let processedFiles = validFiles;
    
    // Add fallback test files if no valid files
    if (!validFiles.length) {
      console.log('[SequentialCodeDisplay] No valid files, creating test files');
      processedFiles = [
        {
          filename: 'lib.rs',
          content: `use anchor_lang::prelude::*;

#[program]
pub mod my_program {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}`,
          language: 'rust'
        }
      ];
    }
    
    setFinalFilesToDisplay(processedFiles);
    
    // Reset for new files
    console.log('[SequentialCodeDisplay] Resetting state for new files');
    setCurrentFileIndex(0);
    setIsTyping(false);
    setDisplayedText('');
  }, [files, validFiles.length]); // Use both files and validFiles.length as dependencies
  
  useEffect(() => {
    console.log('[SequentialCodeDisplay] Typewriter effect check:', {
      mounted,
      finalFilesLength: finalFilesToDisplay.length,
      currentFileIndex,
      condition: !mounted || !finalFilesToDisplay.length || currentFileIndex >= finalFilesToDisplay.length
    });
    
    if (!mounted || !finalFilesToDisplay.length || currentFileIndex >= finalFilesToDisplay.length) return;
    
    const currentFile = finalFilesToDisplay[currentFileIndex];
    console.log('[SequentialCodeDisplay] Current file for typewriter:', {
      filename: currentFile?.filename,
      hasContent: !!currentFile?.content,
      contentLength: currentFile?.content?.length || 0
    });
    
    if (!currentFile) return; // Extra safety check
    
    const truncatedContent = getTruncatedContent(currentFile.content);
    console.log('[SequentialCodeDisplay] Starting typewriter with content length:', truncatedContent.length);
    console.log('[SequentialCodeDisplay] Content preview:', truncatedContent.substring(0, 100));
    
    // Start typewriter effect
    setIsTyping(true);
    setDisplayedText('');
    
    let charIndex = 0;
    const timer = setInterval(() => {
      if (charIndex < truncatedContent.length) {
        setDisplayedText(truncatedContent.substring(0, charIndex + 1));
        charIndex++;
      } else {
        console.log('[SequentialCodeDisplay] Typewriter complete for file:', currentFile.filename);
        clearInterval(timer);
        setIsTyping(false);
        
        // Move to next file after 2 seconds
        setTimeout(() => {
          if (currentFileIndex < finalFilesToDisplay.length - 1) {
            console.log('[SequentialCodeDisplay] Moving to next file');
            setCurrentFileIndex(prev => prev + 1);
          } else {
            console.log('[SequentialCodeDisplay] All files completed');
          }
        }, 2000);
      }
    }, 15); // Fast typewriter speed
    
    return () => clearInterval(timer);
  }, [currentFileIndex, finalFilesToDisplay.length, mounted]);
  
  // Don't render on server to avoid hydration issues
  if (!mounted) {
    console.log('[SequentialCodeDisplay] Not mounted, returning null');
    return null;
  }
  
  if (!finalFilesToDisplay.length) {
    console.log('[SequentialCodeDisplay] No final files to display, returning null');
    return null;
  }
  
  const currentFile = finalFilesToDisplay[currentFileIndex];
  if (!currentFile) {
    console.log('[SequentialCodeDisplay] No current file, returning null');
    return null;
  }
  
  return (
    <div className="mt-2 mb-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={`file-${currentFileIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-gray-900/30 rounded-lg p-3 border-l-4 border-cyan-500/50"
        >
          {/* File header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-400">📄</span>
              <span className="text-xs font-mono text-cyan-400">
                {currentFile.filename || 'unknown.rs'}
              </span>
              <span className="text-xs text-gray-500">
                ({currentFileIndex + 1}/{finalFilesToDisplay.length})
              </span>
            </div>
            {!isTyping && currentFileIndex < finalFilesToDisplay.length - 1 && (
              <span className="text-xs text-gray-500">Next in 2s...</span>
            )}
          </div>
          
          {/* Code content */}
          <div className="bg-gray-950/50 rounded p-2 max-h-48 overflow-hidden">
            <pre className="text-xs text-gray-300 font-mono">
              <code className={`language-${currentFile.language || 'rust'}`}>
                {displayedText}
                {isTyping && <span className="text-cyan-400 animate-pulse">|</span>}
              </code>
            </pre>
          </div>
          
          {/* Progress dots */}
          <div className="flex gap-1 mt-2 justify-center">
            {finalFilesToDisplay.map((_, idx) => (
              <div
                key={`dot-${idx}`}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentFileIndex 
                    ? 'bg-cyan-400 w-4' 
                    : idx < currentFileIndex 
                      ? 'bg-cyan-600' 
                      : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SequentialCodeDisplay;