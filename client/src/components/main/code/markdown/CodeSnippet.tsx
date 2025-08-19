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

interface CodeSnippetProps {
  children?: React.ReactNode;
  enableTypewriter?: boolean;
  language?: string;
  onTypewriterComplete?: () => void;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ children, enableTypewriter = false, language = 'javascript', onTypewriterComplete }) => {
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
    
    const STEP = 3;  // chars per tick (slower for better effect)
    const SPEED = 25; // ms per tick (slower speed)
    
    let pos = 0;
    const id = setInterval(() => {
      pos += STEP;
      const currentText = codeString.slice(0, pos);
      setDisplayedCode(currentText);
      
      if (pos >= codeString.length) {
        clearInterval(id);
        setIsTyping(false);
        // Small delay before calling completion to let animation finish
        setTimeout(() => {
          onTypewriterComplete?.();
        }, 100);
      }
    }, SPEED);

    return () => clearInterval(id);
  }, [codeString, enableTypewriter, onTypewriterComplete]);

  const handleCopy = async () => {
    if (typeof children === "string") {
      await navigator.clipboard.writeText(children);
    }
  };

  const isDark = useColorModeValue(false, true);
  
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
    <div className="relative my-[10px] border border-[rgb(54,65,92)] rounded-[5px] overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="absolute top-2 right-2 z-[1000] h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
      >
        <GoCopy />
      </Button>
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
          fontSize: '0.8rem',
          fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
        }}
      />
    </div>
  );
};

export default CodeSnippet;
