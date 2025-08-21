import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

const SequentialCodeDisplay: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [mounted, setMounted] = useState(false);
  
  // Fix hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Validate files array and provide sample content if missing
  const validFiles = files?.filter(f => f && f.filename).map(f => ({
    ...f,
    content: f.content || getSampleContent(f.filename, f.language)
  })) || [];
  
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
  
  useEffect(() => {
    if (!validFiles.length) return;
    
    // Reset for new files
    setCurrentFileIndex(0);
    setIsTyping(false);
    setDisplayedText('');
  }, [files]); // Use original files prop for dependency
  
  useEffect(() => {
    if (!mounted || !validFiles.length || currentFileIndex >= validFiles.length) return;
    
    const currentFile = validFiles[currentFileIndex];
    if (!currentFile) return; // Extra safety check
    
    const truncatedContent = getTruncatedContent(currentFile.content);
    
    // Start typewriter effect
    setIsTyping(true);
    setDisplayedText('');
    
    let charIndex = 0;
    const timer = setInterval(() => {
      if (charIndex < truncatedContent.length) {
        setDisplayedText(truncatedContent.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
        
        // Move to next file after 2 seconds
        setTimeout(() => {
          if (currentFileIndex < validFiles.length - 1) {
            setCurrentFileIndex(prev => prev + 1);
          }
        }, 2000);
      }
    }, 15); // Fast typewriter speed
    
    return () => clearInterval(timer);
  }, [currentFileIndex, validFiles.length, mounted]);
  
  // Don't render on server to avoid hydration issues
  if (!mounted) return null;
  
  if (!validFiles.length) return null;
  
  const currentFile = validFiles[currentFileIndex];
  if (!currentFile) return null; // Safety check
  
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
                ({currentFileIndex + 1}/{validFiles.length})
              </span>
            </div>
            {!isTyping && currentFileIndex < validFiles.length - 1 && (
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
            {validFiles.map((_, idx) => (
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