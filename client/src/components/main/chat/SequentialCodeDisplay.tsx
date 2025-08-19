import React, { useState, useEffect } from 'react';

interface CodeFile {
  filename: string;
  content: string;
  language: string;
}

const SequentialCodeDisplay: React.FC<{ files: CodeFile[] }> = ({ files }) => {
  const [currentIndex, setCurrentIndex] = useState(-1); // Start with no file selected
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Start the animation after a brief delay
  useEffect(() => {
    if (!files || files.length === 0) return;
    
    const startTimer = setTimeout(() => {
      setHasStarted(true);
      setCurrentIndex(0);
    }, 1000);
    
    return () => clearTimeout(startTimer);
  }, [files]);
  
  // Handle typewriter effect for current file
  useEffect(() => {
    if (!hasStarted || !files || currentIndex < 0 || currentIndex >= files.length) return;
    
    const currentFile = files[currentIndex];
    let charIndex = 0;
    setDisplayedText('');
    setIsTyping(true);
    
    // Much slower typewriter effect - 100ms per character
    const typeTimer = setInterval(() => {
      if (charIndex < currentFile.content.length) {
        setDisplayedText(currentFile.content.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeTimer);
        setIsTyping(false);
        
        // Wait 3 seconds then move to next file
        setTimeout(() => {
          if (currentIndex < files.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }, 3000);
      }
    }, 100); // Much slower - 100ms per character
    
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
          {currentIndex >= 0 ? `${currentIndex + 1}/${files.length}` : '0/0'}
        </span>
      </div>
      
      {/* Animated file list that iterates down */}
      <div className="space-y-2">
        {files.map((file, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 p-2 rounded transition-all duration-500 ${
              idx < currentIndex ? 'bg-green-900/20 text-green-400' :
              idx === currentIndex ? 'bg-blue-900/30 text-blue-300 shadow-md border border-blue-500/30' :
              'bg-gray-800/30 text-gray-500'
            }`}
          >
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx < currentIndex ? 'bg-green-500' :
              idx === currentIndex ? 'bg-blue-500 animate-pulse' :
              'bg-gray-600'
            }`} />
            <span className="font-mono text-xs">{file.filename}</span>
            {idx < currentIndex && <span className="text-xs text-green-400">✓</span>}
            {idx === currentIndex && <span className="text-xs text-blue-400 animate-pulse">●</span>}
          </div>
        ))}
      </div>
      
      {/* Small code snippet box - only shows current file */}
      {currentIndex >= 0 && currentIndex < files.length && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-1 font-mono">
            {files[currentIndex].filename}
          </div>
          <div className="bg-gray-900 rounded p-3 h-32 overflow-y-auto border border-gray-700">
            <pre className="text-xs text-gray-100 font-mono leading-tight">
              <code>
                {displayedText}
                {isTyping && <span className="text-blue-400 animate-pulse">|</span>}
              </code>
            </pre>
          </div>
          {isTyping && (
            <div className="text-xs text-gray-500 mt-1">
              Generating code... {Math.round((displayedText.length / files[currentIndex].content.length) * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SequentialCodeDisplay;