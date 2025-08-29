"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FileText, Code, Database, Settings, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import CompactCodeSnippet from '../code/markdown/CompactCodeSnippet';
import eventBus from '@/lib/eventBus';

interface FileData {
  id: string;
  path: string;
  content: string;
  status: 'pending' | 'typing' | 'complete';
  language: string;
  icon: React.ReactNode;
}

interface FileWrittenEvent {
  event: 'file-written';
  path: string;
  content: string;
}

const getFileInfo = (path: string) => {
  const filename = path.split('/').pop() || path;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  let language = 'text';
  let icon = <FileText className="h-4 w-4" />;
  
  switch (ext) {
    case 'rs':
      language = 'rust';
      icon = <span className="text-orange-500">🦀</span>;
      break;
    case 'ts':
    case 'tsx':
      language = 'typescript';
      icon = <span className="text-blue-500">📘</span>;
      break;
    case 'js':
    case 'jsx':
      language = 'javascript';
      icon = <span className="text-yellow-500">📜</span>;
      break;
    case 'json':
      language = 'json';
      icon = <span className="text-green-500">🗂️</span>;
      break;
    case 'toml':
    case 'yml':
    case 'yaml':
      language = 'toml';
      icon = <span className="text-purple-500">⚙️</span>;
      break;
    case 'md':
      language = 'markdown';
      icon = <span className="text-gray-400">📝</span>;
      break;
    case 'lock':
      language = 'text';
      icon = <span className="text-gray-500">🔒</span>;
      break;
    default:
      icon = <span className="text-gray-400">📄</span>;
  }
  
  return { filename, language, icon };
};

export default function FileGenerationQueue() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const onFileWritten = (event: FileWrittenEvent) => {
      const { filename, language, icon } = getFileInfo(event.path);
      
      const newFile: FileData = {
        id: `${Date.now()}-${Math.random()}`,
        path: event.path,
        content: event.content,
        status: 'pending',
        language,
        icon,
      };
      
      setFiles(prev => [...prev, newFile]);
    };
    
    // Listen for file-written events from the server
    eventBus.on('file-written', onFileWritten);
    
    return () => eventBus.off('file-written', onFileWritten);
  }, []);
  
  // Handle sequential typing
  useEffect(() => {
    if (files.length === 0) return;
    
    const currentFile = files[currentIndex];
    if (!currentFile || currentFile.status !== 'pending') return;
    
    // Start typing the current file
    setFiles(prev => prev.map((file, idx) => 
      idx === currentIndex 
        ? { ...file, status: 'typing' }
        : file
    ));
  }, [files, currentIndex]);
  
  const handleTypewriterComplete = () => {
    // Mark current file as complete
    setFiles(prev => prev.map((file, idx) => 
      idx === currentIndex 
        ? { ...file, status: 'complete' }
        : file
    ));
    
    // Move to next file after a brief delay
    setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + 1, files.length - 1));
    }, 200);
  };
  
  if (files.length === 0) return null;
  
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-cyan-400 animate-pulse" />
          <span>Live Code Generation</span>
        </div>
        <div className="text-xs font-mono bg-gray-800 px-2 py-1 rounded">
          {files.filter(f => f.status === 'complete').length}/{files.length} files
        </div>
      </div>
      
      <AnimatePresence>
        {files.map((file, index) => {
          const { filename } = getFileInfo(file.path);
          const isActive = index === currentIndex;
          const isComplete = file.status === 'complete';
          const isPending = file.status === 'pending' && index > currentIndex;
          
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`
                rounded-lg border transition-all duration-200
                ${isActive 
                  ? 'border-cyan-500/50 bg-cyan-500/5' 
                  : isComplete 
                    ? 'border-green-500/30 bg-green-500/5' 
                    : 'border-gray-700 bg-gray-900/20'
                }
              `}
            >
              {/* File Header */}
              <div className="flex items-center justify-between p-3 pb-2">
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <div className="relative">
                      {file.icon}
                      <Check className="absolute -top-1 -right-1 h-3 w-3 text-green-500 bg-gray-900 rounded-full" />
                    </div>
                  ) : isActive ? (
                    <div className="relative">
                      {file.icon}
                      <Loader2 className="absolute -top-1 -right-1 h-3 w-3 text-cyan-400 animate-spin bg-gray-900 rounded-full" />
                    </div>
                  ) : (
                    <div className="opacity-50">{file.icon}</div>
                  )}
                  <span className="text-sm font-medium">{filename}</span>
                  <span className="text-xs text-gray-500 uppercase">{file.language}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {file.content.split('\n').length} lines
                </div>
              </div>
              
              {/* Code Content */}
              {(isActive || isComplete) && (
                <div className="px-3 pb-3">
                  <CompactCodeSnippet
                    enableTypewriter={isActive && file.status === 'typing'}
                    language={file.language}
                    filename={filename}
                    typewriterSpeed={1}
                    onTypewriterComplete={isActive ? handleTypewriterComplete : undefined}
                  >
                    {file.content}
                  </CompactCodeSnippet>
                </div>
              )}
              
              {isPending && (
                <div className="px-3 pb-3 text-xs text-gray-500 italic">
                  Waiting to generate...
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}