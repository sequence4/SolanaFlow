import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { GoCopy } from "react-icons/go";
import { useColorModeValue } from '../../../ui/color-mode';
import '@/styles/markdown/markdownStyle.css';

interface CodeSnippetProps {
  children?: React.ReactNode;
  enableTypewriter?: boolean;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ children, enableTypewriter = false }) => {
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
    
    const STEP = 8;  // chars per tick
    const SPEED = 2; // ms per tick
    
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
  }, [codeString, enableTypewriter]);

  const handleCopy = async () => {
    if (typeof children === "string") {
      await navigator.clipboard.writeText(children);
    }
  };

  const codeSnippetBgColor = useColorModeValue("var(--code-snippet-bg-light)", "#1f2533");
  const codeSnippetTextColor = useColorModeValue("var(--code-snippet-text-light)", "#676f82");

  return (
    <pre
      className="relative p-[10px] my-[10px] text-[0.8rem]"
      style={{
        maxWidth: "100%",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        overflowX: "hidden",
        backgroundColor: codeSnippetBgColor,
        color: codeSnippetTextColor,
        border: "1px solid rgb(54, 65, 92)",
        borderRadius: "5px",
        fontFamily: "'Fira Code', monospace",
        lineHeight: "1.15rem",
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="absolute top-1 right-1 z-[1000] h-6 w-6 p-0"
      >
        <GoCopy />
      </Button>
      {displayedCode}
      {isTyping && <span className="animate-pulse">|</span>}
    </pre>
  );
};

export default CodeSnippet;
