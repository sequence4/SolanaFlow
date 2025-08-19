import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { GoCopy } from "react-icons/go";
import { useColorModeValue } from '../../../ui/color-mode';
import '@/styles/markdown/markdownStyle.css';

interface CompactCodeSnippetProps {
  children?: React.ReactNode;
  enableTypewriter?: boolean;
  filename?: string;
  language?: string;
  lineCount?: number;
  typewriterSpeed?: number;
}

const CompactCodeSnippet: React.FC<CompactCodeSnippetProps> = ({ 
  children, 
  enableTypewriter = false, 
  filename,
  language = 'rust',
  lineCount,
  typewriterSpeed = 1 
}) => {
  const [displayedCode, setDisplayedCode] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const codeString = typeof children === "string" ? children : String(children);
  
  useEffect(() => {
    if (!enableTypewriter || !codeString) {
      setDisplayedCode(codeString);
      return;
    }

    setIsTyping(true);
    setDisplayedCode('');
    
    const STEP = 12;  // More chars per tick for faster typing
    const SPEED = typewriterSpeed; // ms per tick, configurable for logs
    
    let pos = 0;
    const id = setInterval(() => {
      pos += STEP;
      setDisplayedCode(codeString.slice(0, pos));
      if (pos >= codeString.length) {
        clearInterval(id);
        setIsTyping(false);
      }
    }, SPEED);

    return () => clearInterval(id);
  }, [codeString, enableTypewriter, typewriterSpeed]);

  const handleCopy = async () => {
    if (typeof children === "string") {
      await navigator.clipboard.writeText(children);
    }
  };

  const codeSnippetBgColor = useColorModeValue("var(--code-snippet-bg-light)", "#1a1a1a");
  const codeSnippetTextColor = useColorModeValue("var(--code-snippet-text-light)", "#e1e5e9");
  const headerBgColor = useColorModeValue("#f5f5f5", "#2a2a2a");

  return (
    <div className="compact-code-container">
      {(filename || language || lineCount) && (
        <div 
          className="code-header flex items-center justify-between px-3 py-1 text-xs border-b"
          style={{
            backgroundColor: headerBgColor,
            borderColor: "rgb(54, 65, 92)"
          }}
        >
          <div className="flex items-center gap-2">
            {filename && <span className="text-blue-400">📄 {filename}</span>}
            {language && <span className="text-gray-400 uppercase">{language}</span>}
            {lineCount && <span className="text-gray-500">{lineCount} lines</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-4 w-4 p-0 hover:bg-gray-700"
          >
            <GoCopy className="text-xs" />
          </Button>
        </div>
      )}
      
      <pre
        className="relative p-3 text-xs overflow-y-auto"
        style={{
          maxHeight: "200px",
          minHeight: "80px",
          maxWidth: "100%",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          backgroundColor: codeSnippetBgColor,
          color: codeSnippetTextColor,
          border: "1px solid rgb(54, 65, 92)",
          borderRadius: "4px",
          fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
          lineHeight: "1.4",
          fontSize: "12px"
        }}
      >
        {!filename && !language && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="absolute top-1 right-1 z-[1000] h-5 w-5 p-0"
          >
            <GoCopy className="text-xs" />
          </Button>
        )}
        {displayedCode}
        {isTyping && <span className="animate-pulse text-cyan-400">|</span>}
      </pre>
    </div>
  );
};

export default CompactCodeSnippet;