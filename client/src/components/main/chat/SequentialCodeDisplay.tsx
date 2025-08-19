import React, { useState, useEffect } from 'react';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

interface SequentialCodeDisplayProps {
  files: CodeFile[];
  onAllFilesComplete?: () => void;
}

export const SequentialCodeDisplay: React.FC<SequentialCodeDisplayProps> = ({ 
  files, 
  onAllFilesComplete 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  useEffect(() => {
    if (!files || files.length === 0) return;
    
    // Start after a brief delay
    if (!hasStarted) {
      const startTimer = setTimeout(() => {
        setHasStarted(true);
      }, 500);
      return () => clearTimeout(startTimer);
    }
    
    if (currentIndex >= files.length) {
      // All files completed
      if (onAllFilesComplete) {
        onAllFilesComplete();
      }
      return;
    }
    
    const currentFile = files[currentIndex];
    let charIndex = 0;
    setDisplayedText('');
    setIsTyping(true);
    
    // Typewriter effect - slower for visibility
    const typeTimer = setInterval(() => {
      if (charIndex < currentFile.content.length) {
        setDisplayedText(currentFile.content.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeTimer);
        setIsTyping(false);
        
        // Wait 2 seconds then move to next file
        setTimeout(() => {
          if (currentIndex < files.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else {
            // All files completed
            if (onAllFilesComplete) {
              onAllFilesComplete();
            }
          }
        }, 2000);
      }
    }, 30); // 30ms per character for good visibility
    
    return () => clearInterval(typeTimer);
  }, [currentIndex, files, hasStarted, onAllFilesComplete]);
  
  if (!files || files.length === 0 || !hasStarted) {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Preparing code generation...</span>
          <span className="text-sm">0%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full animate-pulse"></div>
      </div>
    );
  }
  
  const currentFile = files[currentIndex];
  const progress = Math.round(((currentIndex + (isTyping ? 0.5 : 1)) / files.length) * 100);
  
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Code Generation</span>
        <span className="text-sm">{progress}%</span>
      </div>
      
      {/* File info */}
      <div className="flex items-center gap-2 text-sm">
        <span>🦀</span>
        <span className="font-mono text-yellow-400">{currentFile.filename}</span>
        <span className="text-gray-500">({currentIndex + 1}/{files.length})</span>
      </div>
      
      {/* Code display with typewriter */}
      <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
        <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
          <code>
            {displayedText}
            {isTyping && <span className="text-blue-400 animate-pulse">|</span>}
          </code>
        </pre>
      </div>
      
      {/* File progress dots */}
      <div className="flex gap-1">
        {files.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              idx < currentIndex ? 'bg-green-500' :
              idx === currentIndex ? 'bg-blue-500 animate-pulse' :
              'bg-gray-700'
            }`}
          />
        ))}
      </div>
      
      {/* Status text */}
      <div className="text-xs text-gray-500">
        {isTyping ? 'Generating...' : 
         currentIndex < files.length - 1 ? 'Moving to next file...' : 'Generation complete!'}
      </div>
    </div>
  );
};

export default SequentialCodeDisplay;