import React, { useState, useEffect } from 'react';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

const SequentialCodeDisplay: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  console.log('[SEQUENTIAL-DISPLAY] Component rendered with files:', files);
  console.log('[SEQUENTIAL-DISPLAY] Files count:', files?.length || 0);
  
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [fileStates, setFileStates] = useState<Array<{ 
    expanded: boolean; 
    displayedText: string; 
    isTyping: boolean;
    isComplete: boolean;
  }>>([]);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Initialize file states
  useEffect(() => {
    console.log('[SEQUENTIAL-DISPLAY] useEffect triggered with files:', files?.length || 0);
    
    if (!files || files.length === 0) {
      console.log('[SEQUENTIAL-DISPLAY] No files provided, skipping initialization');
      return;
    }
    
    console.log('[SEQUENTIAL-DISPLAY] Initializing file states for', files.length, 'files');
    console.log('[SEQUENTIAL-DISPLAY] File names:', files.map(f => f.filename));
    
    setFileStates(files.map(() => ({
      expanded: false,
      displayedText: '',
      isTyping: false,
      isComplete: false
    })));
    
    // Start after brief delay
    const startTimer = setTimeout(() => {
      console.log('[SEQUENTIAL-DISPLAY] Starting animation sequence');
      setHasStarted(true);
      setCurrentIndex(0);
    }, 1000);
    
    return () => clearTimeout(startTimer);
  }, [files]);
  
  // Handle file expansion and typewriter effect
  useEffect(() => {
    console.log('[SEQUENTIAL-DISPLAY] Animation effect triggered:', { hasStarted, currentIndex, filesLength: files?.length });
    
    if (!hasStarted || !files || currentIndex < 0 || currentIndex >= files.length) {
      console.log('[SEQUENTIAL-DISPLAY] Skipping animation - conditions not met');
      return;
    }
    
    console.log('[SEQUENTIAL-DISPLAY] Starting animation for file', currentIndex, ':', files[currentIndex].filename);
    
    // Expand current file
    setFileStates(prev => prev.map((state, idx) => 
      idx === currentIndex ? { ...state, expanded: true, isTyping: true } : state
    ));
    
    const currentFile = files[currentIndex];
    let charIndex = 0;
    
    console.log('[SEQUENTIAL-DISPLAY] Starting typewriter for:', currentFile.filename, 'content length:', currentFile.content.length);
    
    // Very slow typewriter effect - 150ms per character
    const typeTimer = setInterval(() => {
      if (charIndex < currentFile.content.length) {
        const newText = currentFile.content.substring(0, charIndex + 1);
        
        setFileStates(prev => prev.map((state, idx) => 
          idx === currentIndex ? { ...state, displayedText: newText } : state
        ));
        
        charIndex++;
        
        if (charIndex % 10 === 0) { // Log every 10 characters
          console.log('[SEQUENTIAL-DISPLAY] Typewriter progress:', charIndex, '/', currentFile.content.length);
        }
      } else {
        console.log('[SEQUENTIAL-DISPLAY] Typewriter completed for', currentFile.filename);
        clearInterval(typeTimer);
        
        // Mark current file as complete
        setFileStates(prev => prev.map((state, idx) => 
          idx === currentIndex ? { ...state, isTyping: false, isComplete: true } : state
        ));
        
        // Wait 2 seconds then move to next file
        setTimeout(() => {
          if (currentIndex < files.length - 1) {
            console.log('[SEQUENTIAL-DISPLAY] Moving to next file:', currentIndex + 1);
            setCurrentIndex(currentIndex + 1);
          } else {
            console.log('[SEQUENTIAL-DISPLAY] All files completed');
          }
        }, 2000);
      }
    }, 150); // Very slow - 150ms per character for visibility
    
    return () => clearInterval(typeTimer);
  }, [currentIndex, files, hasStarted]);
  
  if (!files || files.length === 0) return null;
  
  if (!hasStarted) {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🦀 Preparing Solana program files...</span>
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">🦀 Solana Program Files</span>
        <span className="text-xs text-gray-500">
          {currentIndex >= 0 ? `${fileStates.filter(s => s.isComplete).length}/${files.length} complete` : 'Starting...'}
        </span>
      </div>
      
      {/* Multiple file boxes - all visible, expand one by one */}
      <div className="space-y-2">
        {files.map((file, idx) => {
          const fileState = fileStates[idx] || { expanded: false, displayedText: '', isTyping: false, isComplete: false };
          
          return (
            <div
              key={idx}
              className={`border rounded-lg transition-all duration-500 ${
                fileState.isComplete ? 'border-green-500 bg-green-950/20' :
                idx === currentIndex ? 'border-blue-500 bg-blue-950/20 shadow-lg' :
                'border-gray-600 bg-gray-800/30'
              }`}
            >
              {/* File header - always visible */}
              <div className={`flex items-center gap-2 p-3 transition-colors ${
                fileState.isComplete ? 'text-green-300' :
                idx === currentIndex ? 'text-blue-300' :
                'text-gray-400'
              }`}>
                <div className={`w-2 h-2 rounded-full transition-all ${
                  fileState.isComplete ? 'bg-green-500' :
                  idx === currentIndex ? 'bg-blue-500 animate-pulse' :
                  'bg-gray-500'
                }`} />
                <span className="font-mono text-sm">{file.filename}</span>
                {fileState.isComplete && <span className="text-green-400 text-sm">✓</span>}
                {fileState.isTyping && <span className="text-blue-400 text-sm animate-pulse">●</span>}
                {idx > currentIndex && <span className="text-gray-500 text-sm">○</span>}
              </div>
              
              {/* Expandable code content */}
              {fileState.expanded && (
                <div className="px-3 pb-3">
                  <div className="bg-gray-900 rounded p-3 h-32 overflow-y-auto border border-gray-700">
                    <pre className="text-xs text-gray-100 font-mono leading-tight">
                      <code>
                        {fileState.displayedText}
                        {fileState.isTyping && <span className="text-blue-400 animate-pulse">|</span>}
                      </code>
                    </pre>
                  </div>
                  {fileState.isTyping && (
                    <div className="text-xs text-gray-500 mt-2">
                      Generating... {Math.round((fileState.displayedText.length / file.content.length) * 100)}%
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SequentialCodeDisplay;