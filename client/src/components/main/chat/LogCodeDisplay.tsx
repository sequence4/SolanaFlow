import React, { useState, useEffect } from 'react';
import CompactCodeSnippet from '../code/markdown/CompactCodeSnippet';

interface LogCodeFile {
  filename: string;
  content: string;
  language: string;
  status: 'pending' | 'typing' | 'completed';
}

interface LogCodeDisplayProps {
  files: LogCodeFile[];
  onAllFilesComplete?: () => void;
}

const LogCodeDisplay: React.FC<LogCodeDisplayProps> = ({ 
  files, 
  onAllFilesComplete 
}) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<LogCodeFile[]>([]);

  useEffect(() => {
    if (files.length === 0) return;
    
    // Initialize all files as pending
    setProcessedFiles(files.map(file => ({ ...file, status: 'pending' })));
    setCurrentFileIndex(0);
  }, [files]);

  useEffect(() => {
    if (processedFiles.length === 0) return;

    // Start typing the current file
    if (currentFileIndex < processedFiles.length) {
      setProcessedFiles(prev => prev.map((file, index) => 
        index === currentFileIndex 
          ? { ...file, status: 'typing' }
          : file
      ));
    }
  }, [currentFileIndex, processedFiles.length]);

  const handleFileTypewriterComplete = () => {
    // Mark current file as completed
    setProcessedFiles(prev => prev.map((file, index) => 
      index === currentFileIndex 
        ? { ...file, status: 'completed' }
        : file
    ));

    // Move to next file
    if (currentFileIndex < processedFiles.length - 1) {
      setTimeout(() => {
        setCurrentFileIndex(prev => prev + 1);
      }, 300); // Small delay between files
    } else {
      // All files completed
      setTimeout(() => {
        onAllFilesComplete?.();
      }, 500);
    }
  };

  const getFileEmoji = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'rs': return '🦀';
      case 'toml': return '📋';
      case 'js': case 'jsx': return '📄';
      case 'ts': case 'tsx': return '📘';
      case 'json': return '📄';
      case 'md': return '📝';
      case 'yml': case 'yaml': return '⚙️';
      default: return '📄';
    }
  };

  const getStatusIndicator = (status: LogCodeFile['status']): string => {
    switch (status) {
      case 'pending': return '⏳';
      case 'typing': return '⌨️';
      case 'completed': return '✅';
      default: return '⏳';
    }
  };

  return (
    <div className="log-code-display w-full space-y-4">
      {/* File Queue Status */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {processedFiles.map((file, index) => (
          <div 
            key={index}
            className={`flex items-center gap-2 p-2 rounded ${
              index === currentFileIndex ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-gray-900/20'
            }`}
          >
            <span>{getFileEmoji(file.filename)}</span>
            <span className="truncate flex-1">{file.filename}</span>
            <span>{getStatusIndicator(file.status)}</span>
          </div>
        ))}
      </div>

      {/* Current File Display */}
      {processedFiles.length > 0 && currentFileIndex < processedFiles.length && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <span>{getFileEmoji(processedFiles[currentFileIndex].filename)}</span>
            <span>Generating: {processedFiles[currentFileIndex].filename}</span>
            <span className="text-xs text-gray-400">
              ({currentFileIndex + 1}/{processedFiles.length})
            </span>
          </div>
          
          <CompactCodeSnippet
            filename={processedFiles[currentFileIndex].filename}
            language={processedFiles[currentFileIndex].language}
            enableTypewriter={processedFiles[currentFileIndex].status === 'typing'}
            typewriterSpeed={15}
            onTypewriterComplete={handleFileTypewriterComplete}
          >
            {processedFiles[currentFileIndex].content}
          </CompactCodeSnippet>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
          style={{ 
            width: `${((currentFileIndex + (processedFiles[currentFileIndex]?.status === 'completed' ? 1 : 0)) / processedFiles.length) * 100}%` 
          }}
        />
      </div>
    </div>
  );
};

export default LogCodeDisplay;