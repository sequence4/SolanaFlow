/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Terminal } from 'lucide-react';
import { useColorModeValue } from '@/components/ui/color-mode';

interface CommandHistoryItem {
  command: string;
  output: string;
  isError?: boolean;
  timestamp: Date;
}

export default function SolanaTerminal() {
  const [input, setInput] = useState('');

  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);

  const [showCursor, setShowCursor] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const terminalBg = useColorModeValue(
    'var(--terminal-bg-light)',
    'var(--terminal-bg-dark)'
  );
  const terminalBorder = useColorModeValue(
    'var(--border-2-light)',
    'var(--border-2-dark)'
  );

  useEffect(() => {
    const now = new Date();
    setCommandHistory([
      {
        command: 'solana --version',
        output: 'v2.2.7',
        timestamp: now,
      },
      {
        command: 'solana balance',
        output: '28.54 SOL',
        timestamp: new Date(now.getTime() - 60_000),
      },
    ]);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setShowCursor((prev) => !prev), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    terminalRef.current?.addEventListener('click', focusInput);
    return () => terminalRef.current?.removeEventListener('click', focusInput);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    let output = '';
    let isError = false;

    if (input.startsWith('solana ')) {
      if (input.includes('deploy')) {
        output =
          'Program deployed successfully\nProgram ID: BPF1H9tDMX3NoTX7QK3BYd2BDTUDYxkecERJHtbNsztD';
      } else if (input.includes('balance')) {
        output = '95.95 SOL';
      } else if (input.includes('help')) {
        output = `USAGE:
  solana [OPTIONS] <SUBCOMMAND>

OPTIONS:
  -h, --help    Print help information
  -V, --version Print version information

SUBCOMMANDS:
  balance       Get wallet balance
  deploy        Deploy a program
  transfer      Transfer tokens`;
      } else {
        output = `Command '${input}' executed successfully`;
      }
    } else if (input === 'clear' || input === 'cls') {
      setCommandHistory([]);
      setInput('');
      return;
    } else {
      output = `Command not found: ${input}`;
      isError = true;
    }

    setCommandHistory((prev) => [
      ...prev,
      { command: input, output, isError, timestamp: new Date() },
    ]);
    setInput('');
  };

  const formatTimestamp = (date: Date) =>
    date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div
      className="font-oxygen-mono text-xs flex flex-col h-full text-foreground font-mono overflow-hidden bg-card border-border"
    >
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-border">
        <Terminal className="w-3 h-3 mr-2 text-muted-foreground" />
        <span className="font-semibold text-xs text-muted-foreground">Terminal</span>
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        className="flex-1 p-3 overflow-y-auto"
        className="bg-card"
      >
        {commandHistory.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="flex items-center">
              <span className="text-[#7ea465] mr-2">➜</span>
              <span className="text-[#7aa2f7] mr-2">solana-cli</span>
              <span className="text-[#5A5F73] text-xs mr-2">
                {formatTimestamp(item.timestamp)}
              </span>
              <span className="text-foreground">{item.command}</span>
            </div>
            <div
              className={`ml-6 mt-1 whitespace-pre-wrap ${
                item.isError ? 'text-[#FF3B9A]' : 'text-[#E0E0FF]'
              }`}
            >
              {item.output}
            </div>
          </div>
        ))}

        {/* Prompt */}
        <form onSubmit={handleSubmit} className="flex items-center mt-1">
          <span className="text-[#7ea465] mr-2">➜</span>
          <span className="text-[#7aa2f7] mr-2">solana-cli</span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-transparent outline-none text-foreground"
              autoFocus
            />
            {input === '' && showCursor && (
              <span className="absolute top-0 left-0 h-full w-2 bg-foreground opacity-70 animate-blink" />
            )}
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t flex justify-between items-center text-[10px] text-muted-foreground border-border">
        <div className="flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] mr-2" />
          <span className="text-muted-foreground">ONLINE</span>
        </div>
        <div>v1.0.0</div>
        <div>solana-cli</div>
      </div>
    </div>
  );
}
