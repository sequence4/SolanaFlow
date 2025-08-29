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
  language?: string;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ children, language = 'javascript' }) => {
  const codeString = typeof children === "string" ? children : String(children);

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
    <div className="code-snippet-wrapper w-full max-w-full overflow-hidden my-[10px]">
      <div className="relative border border-[rgb(54,65,92)] rounded-[5px] overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute top-2 right-2 z-[1000] h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
        >
          <GoCopy />
        </Button>
        <div className="max-w-full overflow-x-auto">
          <CodeMirror
            value={codeString}
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
              fontSize: '12px',
              fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
              maxHeight: '200px',
              width: '100%',
              minWidth: '100%',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeSnippet;
