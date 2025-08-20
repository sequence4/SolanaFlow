import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Copy, Check } from 'lucide-react';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

const SequentialCodeDisplay: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  console.log('[SEQUENTIAL-DISPLAY] Component rendered with files:', files);
  console.log('[SEQUENTIAL-DISPLAY] Files count:', files?.length || 0);
  
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set([0])); // First file expanded by default
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [typingStates, setTypingStates] = useState<Map<number, {
    isTyping: boolean;
    displayedText: string;
    fullText: string;
  }>>(new Map());
  
  // Initialize with first file expanded
  useEffect(() => {
    if (!files || files.length === 0) return;
    setExpandedFiles(new Set([0])); // Always expand first file
    setTypingStates(new Map()); // Reset typing states
  }, [files]);
  
  // Start typewriter when file is expanded for the first time
  useEffect(() => {
    expandedFiles.forEach(index => {
      const file = files[index];
      if (file && !typingStates.has(index)) {
        startTypewriter(index, file.content);
      }
    });
  }, [expandedFiles, files]);
  
  const toggleFile = (index: number) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFiles(newExpanded);
  };
  
  const startTypewriter = (index: number, content: string) => {
    console.log(`[SEQUENTIAL-DISPLAY] Starting typewriter for file ${index}: ${files[index]?.filename}`);
    
    setTypingStates(prev => new Map(prev).set(index, {
      isTyping: true,
      displayedText: '',
      fullText: content
    }));
    
    let charIndex = 0;
    const timer = setInterval(() => {
      if (charIndex < content.length) {
        setTypingStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(index);
          if (state) {
            newMap.set(index, {
              ...state,
              displayedText: content.substring(0, charIndex + 1)
            });
          }
          return newMap;
        });
        charIndex++;
      } else {
        console.log(`[SEQUENTIAL-DISPLAY] Typewriter completed for file ${index}`);
        clearInterval(timer);
        setTypingStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(index);
          if (state) {
            newMap.set(index, {
              ...state,
              isTyping: false
            });
          }
          return newMap;
        });
      }
    }, 20); // 20ms per character
  };
  
  const copyToClipboard = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  if (!files || files.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic p-4 border-l-4 border-gray-600/30 pl-4">
        No files to display
      </div>
    );
  }

  return (
    <div className="code-generation-flow space-y-1">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>🦀 Generated Files</span>
        <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-[10px]">
          {files.length}
        </span>
      </div>
      
      {files.map((file, index) => {
        const isExpanded = expandedFiles.has(index);
        const isCopied = copiedIndex === index;
        const typeState = typingStates.get(index);
        const displayContent = typeState ? typeState.displayedText : file.content;
        const isTyping = typeState?.isTyping || false;
        
        return (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="file-item border-l-4 border-cyan-500/30 bg-gray-900/20 rounded-r-lg overflow-hidden"
          >
            {/* File Header */}
            <div 
              className="file-header flex items-center justify-between p-3 cursor-pointer hover:bg-gray-900/40 transition-colors duration-200"
              onClick={() => toggleFile(index)}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight size={16} className="text-gray-500" />
                </motion.div>
                <span className="text-sm font-mono text-cyan-400">{file.filename}</span>
                <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
                  {file.language}
                </span>
                <span className="text-xs text-gray-600">
                  {file.content.split('\n').length} lines
                </span>
              </div>
              
              {isExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(file.content, index);
                  }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded hover:bg-gray-800/50"
                >
                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            
            {/* File Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-700/50">
                    <div className="bg-gray-950/50 p-4">
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        <code className={`language-${file.language}`}>
                          {displayContent}
                          {isTyping && <span className="text-cyan-400 animate-pulse ml-1">|</span>}
                        </code>
                      </pre>
                      {isTyping && (
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                          </div>
                          <span>Generating... {Math.round((displayContent.length / file.content.length) * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SequentialCodeDisplay;