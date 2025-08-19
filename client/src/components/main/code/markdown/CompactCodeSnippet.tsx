import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { GoCopy } from "react-icons/go";
import { useColorModeValue } from '../../../ui/color-mode';
import '@/styles/markdown/markdownStyle.css';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { rust } from '@codemirror/lang-rust';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';

interface CompactCodeSnippetProps {
  children?: React.ReactNode;
  enableTypewriter?: boolean;
  filename?: string;
  language?: string;
  lineCount?: number;
  typewriterSpeed?: number;
  onTypewriterComplete?: () => void;
}

const CompactCodeSnippet: React.FC<CompactCodeSnippetProps> = ({ 
  children, 
  enableTypewriter = false, 
  filename,
  language = 'rust',
  lineCount,
  typewriterSpeed = 1,
  onTypewriterComplete
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
        onTypewriterComplete?.();
      }
    }, SPEED);

    return () => clearInterval(id);
  }, [codeString, enableTypewriter, typewriterSpeed, onTypewriterComplete]);

  const handleCopy = async () => {
    if (typeof children === "string") {
      await navigator.clipboard.writeText(children);
    }
  };

  const isDark = useColorModeValue(false, true);
  const headerBgColor = useColorModeValue("#f5f5f5", "#2a2a2a");

  // Get the appropriate language extension
  const getLanguageExtension = () => {
    switch (language.toLowerCase()) {
      case 'rust':
      case 'rs':
        return [rust()];
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return [javascript({ jsx: true, typescript: language.includes('ts') })];
      default:
        return [javascript()];
    }
  };

  return (
    <div className="compact-code-container border border-[rgb(54,65,92)] rounded-[4px] overflow-hidden">
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
      
      <div className="relative">
        {!filename && !language && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="absolute top-2 right-2 z-[1000] h-5 w-5 p-0 bg-black/50 hover:bg-black/70"
          >
            <GoCopy className="text-xs" />
          </Button>
        )}
        <CodeMirror
          value={displayedCode + (isTyping ? '|' : '')}
          theme={isDark ? vscodeDark : githubLight}
          extensions={getLanguageExtension()}
          editable={false}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
          }}
          style={{
            maxHeight: "200px",
            minHeight: "80px",
            fontSize: '12px',
            fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
          }}
        />
      </div>
    </div>
  );
};

export default CompactCodeSnippet;