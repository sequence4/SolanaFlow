"use client";

import React, { useState, useRef, useEffect, useContext } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';

// Context
import ProjectContext from '@/context/project/ProjectContext';
import FileContext from '@/context/file/FileContext';
import { FileTreeItemType } from '@/interfaces/FileTreeItemType';

// API
import { chatAI } from '@/api/aiApi'; 
import { fileApi } from '@/api/fileApi';
import { taskApi } from '@/api/taskApi';

// UI Components
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import eventBus from '@/lib/eventBus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import { 
  Send, 
  Bot, 
  Loader2, 
  X, 
  Maximize2, 
  Minimize2, 
  Code, 
  Image, 
  Paperclip,
  Plus,
  Trash2
} from "lucide-react";
import MarkdownRenderer from '@/components/main/code/markdown/MarkdownRenderer';
import ChatChecklistBubble from './ChatChecklistBubble';
import LogCodeDisplay from './LogCodeDisplay';
import SequentialCodeDisplay from './SequentialCodeDisplay';

export interface AIMessageType {
  text: string;
  sender: 'ai' | 'user';
  files?: FileTreeItemType[];
  timestamp?: Date;
  status?: 'sending' | 'sent' | 'error';
  isLogLine?: boolean;
  isChecklist?: boolean;
  stage?: string;
  pct?: number;
  type?: string;
  codeGenFiles?: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
}

const Chat: React.FC = () => {
    const { projectContext } = useContext(ProjectContext);
    const { 
        selectedFile, 
        fileTree 
    } = useContext(FileContext);

    const [additionalFiles, setAdditionalFiles] = useState<FileTreeItemType[]>([]);
    const [messages, setMessages] = useState<AIMessageType[]>([]);
    const [input, setInput] = useState('');
    const [selectedModel, setSelectedModel] = useState('gpt-4o');
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingMessage, setThinkingMessage] = useState('');
    const taskLogs = useTaskLogs();  // Complete taskLogs object including systemLogs and setSuppressToast
    const { systemLogs } = taskLogs;
    const [lastLogIndex, setLastLogIndex] = useState(0);  // 🟡 NEW
    const [userHasScrolled, setUserHasScrolled] = useState(false); // Track if user manually scrolled
  
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesAreaRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Enhanced scroll function that respects user scroll behavior
    const smartScrollToBottom = () => {
        if (!userHasScrolled && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Detect user scroll behavior
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const element = e.target as HTMLDivElement;
        const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
        
        if (!isAtBottom) {
            setUserHasScrolled(true);
        } else {
            setUserHasScrolled(false);
        }
    };

    useEffect(() => {
        smartScrollToBottom();
    }, [messages, isTyping, isThinking, userHasScrolled]);

    useEffect(() => {
        console.log(selectedFile);
    }, []);

    useEffect(() => {
        const savedMessages = sessionStorage.getItem('chatMessages');
        if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
            const messagesWithDates = parsed.map((msg: AIMessageType) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
            }));
            setMessages(messagesWithDates);
        }
    }, []);

    useEffect(() => {
        if (messages.length > 0) sessionStorage.setItem('chatMessages', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "40px";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // ───────────────────────────────────────────────────────────────────────────
    //  Whenever TaskLogsProvider pushes new lines, append them as AI messages
    // ───────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!systemLogs?.length) return;
        
        // Suppress log spam while building
        if (taskLogs.isBuilding || messages.some(m => m.isChecklist)) {
          setLastLogIndex(systemLogs.length); // swallow logs
          return;
        }

        // Grab the slice we have not injected yet
        const fresh = systemLogs.slice(lastLogIndex);

        /* 🔽 skip the environment / progress status lines we don't want in chat */
        const IGNORE_PREFIXES = [
          "Preparing your build environment",
          "Container is up", 
          "Container URL",
          "Building program",
          "Linking target/deploy",
          "Collecting project files"
        ];

        const visible = fresh.filter(
          line => !IGNORE_PREFIXES.some(p => line.startsWith(p))
        );

        if (visible.length) {
            console.log('[CHAT] Processing system logs:', visible.length, 'new lines');
            
            const logMessages: AIMessageType[] = [];
            
            for (const line of visible) {
                console.log('[CHAT] Processing line:', line);
                
                // Check if this is a JSON message first
                try {
                    if (line.startsWith('{') && line.includes('type')) {
                        const parsed = JSON.parse(line);
                        console.log('[CHAT] Parsed JSON message:', parsed);
                        
                        // Check for code generation messages with files
                        if (parsed.type === 'code-generation' && parsed.files && parsed.files.length > 0) {
                            console.log('[CHAT] Found code-generation message with', parsed.files.length, 'files');
                            
                            // Remove any existing code-gen messages to avoid duplicates
                            setMessages(prev => {
                                const filtered = prev.filter(m => !m.codeGenFiles);
                                console.log('[CHAT] Filtered out previous code-gen messages, remaining:', filtered.length);
                                return filtered;
                            });
                            
                            // Add the new code generation message with files
                            const codeGenMessage = {
                                text: parsed.message || '🦀 Generating Solana program files...',
                                sender: 'ai' as const,
                                timestamp: new Date(),
                                status: 'sent' as const,
                                codeGenFiles: parsed.files
                            };
                            
                            console.log('[CHAT] Creating code-gen message:', codeGenMessage);
                            logMessages.push(codeGenMessage);
                            continue;
                        }
                        
                        // Handle progress-only messages (during dependency installation, etc.)
                        if (parsed.type === 'progress' && parsed.message && parsed.pct !== undefined) {
                            console.log('[CHAT] Found progress message:', parsed.message, 'at', parsed.pct + '%');
                            
                            // Add as regular log message but with progress info
                            logMessages.push({
                                text: `${parsed.message} (${parsed.pct}%)`,
                                sender: 'ai',
                                timestamp: new Date(),
                                status: 'sent',
                                isLogLine: true,
                                pct: parsed.pct,
                                stage: parsed.stage
                            });
                            continue;
                        }
                    }
                } catch (e) {
                    // Not JSON, check if it's a progress percentage line
                    if (line.includes('%') && (line.includes('Building') || line.includes('Generating'))) {
                        console.log('[CHAT] Skipping progress line:', line);
                        continue;
                    }
                }
                
                // Add regular log line (but suppress most during build process)
                if (!taskLogs.isBuilding || line.includes('ERROR') || line.includes('WARN')) {
                    console.log('[CHAT] Adding regular log line:', line);
                    logMessages.push({
                        text: line,
                        sender: 'ai',
                        timestamp: new Date(),
                        status: 'sent',
                        isLogLine: true,
                    });
                }
            }

            if (logMessages.length > 0) {
                console.log('[CHAT] Adding', logMessages.length, 'new messages to chat');
                setMessages(prev => {
                    const newMessages = [...prev, ...logMessages];
                    console.log('[CHAT] Total messages after update:', newMessages.length);
                    return newMessages;
                });
                // Reset user scroll state when new messages arrive
                setUserHasScrolled(false);
                // Smart scroll to bottom
                setTimeout(() => smartScrollToBottom(), 100);
            }
            
            setLastLogIndex(systemLogs.length);
        }
    }, [systemLogs, lastLogIndex, taskLogs.isBuilding, messages]);


    // ———————————————————————————————
    //  Inject a friendly AI note once the build completes
    // ———————————————————————————————
    useEffect(() => {
        const onComplete = () => {
            setMessages(prev => [
                ...prev,
                {
                    text: "✅ Build finished successfully! Let me know what you'd like to do next.",
                    sender: "ai",
                    timestamp: new Date(),
                    status: "sent"
                }
            ]);
            // Reset scroll state for new message
            setUserHasScrolled(false);
            taskLogs.setSuppressToast(false);      // re-enable normal task-log toasts
        };
        eventBus.on("build-complete", onComplete);
        return () => eventBus.off("build-complete", onComplete);
    }, [taskLogs]);

    const fetchFileContent = async (projectId: string, filePath: string): Promise<string> => {
        try {
            const data = await fileApi.getFileContent(projectId, filePath);
            return data.message;
        } catch (error) {
            console.error(`Error fetching content for ${filePath}:`, error);
            return 'Error loading content.';
        }
    };

    const { publicKey, connected } = useWallet();

    useEffect(() => {
        console.log('Wallet connection status:', connected);
        console.log('Wallet public key:', publicKey?.toBase58() || 'Not connected');
    }, [connected, publicKey]);



    const sendMessage = async () => {
        const trimmed = input.trim().toLowerCase();
        if (trimmed === 'build') {
          // 1) prevent toast
          taskLogs.setSuppressToast(true);

          // 2) Add user message first
          setMessages(prev => [
            ...prev,
            { text: input, sender: 'user', timestamp: new Date(), status: 'sent' }
          ]);
          setInput('');
          setUserHasScrolled(false);

          // 3) Wait a moment before showing AI is thinking (more natural)
          await new Promise(resolve => setTimeout(resolve, 800));

          // 4) Show AI thinking state with specific message
          setIsThinking(true);
          setThinkingMessage('Analyzing your project structure and preparing build pipeline...');
          
          // 5) Add thinking delay (2 more seconds)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 6) Stop thinking and show checklist
          setIsThinking(false);
          setThinkingMessage('');
          
          // 7) Add checklist bubble and forward build command
          setMessages(prev => [
            ...prev,
            { text: "", sender: 'ai', isChecklist: true, timestamp: new Date(), status: 'sent' }
          ]);

          // 8) Forward build command globally after the delay
          eventBus.emit('chat-build-command');
          
          return; // stop normal AI flow
        }
        
        if (input.trim()) {
            const selectedFiles = [selectedFile, ...additionalFiles].filter(
                (file): file is FileTreeItemType => Boolean(file)
            );

            console.log("Files selected for context:", selectedFiles);
            
            setMessages([...messages, { 
                text: input, 
                sender: 'user',
                files: selectedFiles,
                timestamp: new Date(),
                status: 'sending'
            }]);
            setInput('');
            setUserHasScrolled(false); // Reset scroll state for new message

            setIsTyping(true);

            try {
                const fileTasks = await Promise.all(
                    selectedFiles.map(async (file) => {
                        if (file.path && projectContext.id) {
                            console.log("Fetching content for file:", file.path);
                            const taskResponse = await fileApi.getFileContent(projectContext.id, file.path);
                            return { filePath: file.path, taskId: taskResponse.taskId };
                        }
                        return null;
                    })
                );

                const fetchContent = async (taskId: string): Promise<string> => {
                    while (true) {
                        const { task } = await taskApi.getTask(taskId);
                        if (task.status === 'succeed') return task.result || 'No content available';
                        if (task.status === 'failed') throw new Error('Failed to fetch file content');
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                };

                const fileContexts = await Promise.all(
                    fileTasks.map(async (fileTask) => {
                        if (fileTask) {
                            const content = await fetchContent(fileTask.taskId);
                            console.log("Fetched content for file:", fileTask.filePath, "Length:", content.length);
                            return {
                                path: fileTask.filePath,
                                content: content || 'No content available',
                            };
                        }
                        return { path: 'Unknown path', content: 'No content available' };
                    })
                );

                const userPublicKeyString = connected && publicKey ? publicKey.toBase58() : '';
                console.log('Using wallet public key for AI request:', userPublicKeyString || 'No wallet connected');

                setMessages(prevMessages => 
                    prevMessages.map(msg => 
                        msg.text === input && msg.sender === 'user' && msg.status === 'sending'
                            ? { ...msg, status: 'sent' }
                            : msg
                    )
                );

                const response = await chatAI(input, fileContexts, userPublicKeyString);
                const responseText = await response;

                setIsTyping(false);

                // Parse code generation files if present
                const codeGenFiles = parseCodeGenFiles(responseText);
                
                setMessages(prevMessages => [
                    ...prevMessages,
                    {
                        text: responseText,
                        sender: 'ai',
                        timestamp: new Date(),
                        status: 'sent',
                        codeGenFiles: codeGenFiles?.map(file => ({
                            ...file,
                            status: 'pending' as const
                        })) || undefined
                    },
                ]);
            } catch (error) {
                setIsTyping(false);
                console.error('Failed to send message to AI:', error);
                setMessages(prevMessages => [
                    ...prevMessages,
                    { 
                        text: 'Failed to get a response from AI.', 
                        sender: 'ai',
                        timestamp: new Date(),
                        status: 'error'
                    },
                ]);
            }
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            sendMessage();
            event.preventDefault(); 
        }
    };

    const handleFileSelect = (file: FileTreeItemType) => {
        if (!additionalFiles.find((f) => f.path === file.path)) {
            setAdditionalFiles(prev => [...prev, file]);
        }
    };

    const removeFile = (path: string) => {
        setAdditionalFiles(prevFiles => 
            prevFiles.filter((file) => file.path !== path)
        );
    };

    const getAllFiles = (nodes: FileTreeItemType[], basePath = ''): FileTreeItemType[] => {
        let allFiles: FileTreeItemType[] = [];
        nodes.forEach(node => {
            const currentPath = `${basePath}/${node.name}`;
            if (node.type === 'file') {
                allFiles.push({ ...node, path: currentPath });
            } else if (node.type === 'directory' && node.children) {
                allFiles = allFiles.concat(getAllFiles(node.children, currentPath));
            }
        });
        return allFiles;
    };

    const allFiles = fileTree ? getAllFiles([fileTree as FileTreeItemType]) : [];

    const handleCustomFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const newFile: FileTreeItemType = {
                name: file.name,
                path: `custom/${file.name}`,
                type: 'file',
            };
            setAdditionalFiles([...additionalFiles, newFile]);
            toast.success("File added", {
                description: `${file.name} has been added to the chat context.`,
                duration: 3000,
            });
        }
    };

    const formatTime = (dateValue?: Date | string) => {
        if (!dateValue) return "";
        const dateObj = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
        return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const clearChat = () => {
        setMessages([]);
        sessionStorage.removeItem('chatMessages');
        localStorage.removeItem('chatMessages');
    };

    // Helper function to detect and parse code generation messages
    const parseCodeGenFiles = (messageText: string) => {
        // Look for patterns indicating code generation with multiple files
        const codeGenPatterns = [
            /Generating.*files?:/i,
            /Creating.*files?:/i,
            /Code generation complete/i,
            /Generated.*files?/i
        ];

        const isCodeGenMessage = codeGenPatterns.some(pattern => pattern.test(messageText));
        if (!isCodeGenMessage) return null;

        // Extract code blocks with filenames
        const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*(.+\.(?:rs|toml|js|ts|json|md|yml|yaml)))?[\s\S]*?\n([\s\S]*?)```/g;
        const files = [];
        let match;

        while ((match = codeBlockRegex.exec(messageText)) !== null) {
            const [, language = 'rust', filename, content] = match;
            if (content && content.trim()) {
                files.push({
                    filename: filename || `file_${files.length + 1}.${language === 'rust' ? 'rs' : 'txt'}`,
                    content: content.trim(),
                    language: language || 'rust'
                });
            }
        }

        return files.length > 1 ? files : null; // Only use LogCodeDisplay for multiple files
    };

    return (
        <div
            className={`flex flex-col h-full ${isExpanded ? "fixed inset-4 z-50" : ""} transition-all duration-300 ease-in-out`}
        >
            <div 
                className="chat-container flex flex-col h-full bg-card border-border overflow-hidden w-full"
            >
                {/* Header */}
                <div className="chat-header flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <h4 className="font-medium text-sm text-foreground">AI Assistant</h4>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={clearChat}
                        >
                            <Trash2 size={14} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {/* Messages */}
                <div 
                    ref={messagesAreaRef}
                    className="messages-area text-sm flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                    onScroll={handleScroll}
                >
                    <AnimatePresence>
                        {messages.map((message, index) => {
                            const isUser = message.sender === 'user';
                            const isLog  = message.isLogLine === true;
                            const displayTime = message.timestamp
                                ? formatTime(message.timestamp)
                                : "03:02 PM";
                            
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex ${isUser ? "justify-end" : "justify-start"} w-full px-2`}
                                >
                                    <div
                                        className={`rounded-lg ${
                                            isUser
                                                ? "user-message bg-primary text-primary-foreground max-w-[85%]"
                                                : isLog
                                                  ? "log-message bg-gray-900/50 text-foreground w-full max-w-[95%]"
                                                  : "ai-message bg-muted text-foreground max-w-[95%]"
                                        } overflow-hidden`}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word', 
                                            overflowWrap: 'break-word'
                                        }}
                                    >
                                        <div className="p-3 w-full">
                                            <div className="flex items-start gap-2 w-full">
                                                {!isUser && (
                                                    <div className="bot-icon-container mt-1 bg-muted-foreground/10 p-1 rounded-full flex-shrink-0">
                                                        <Bot size={14} className="bot-icon text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="leading-relaxed w-full min-w-0">
                                                    {/* Render message content */}
                                                    {(() => {
                                                        if (message.isChecklist) {
                                                            return <ChatChecklistBubble />;
                                                        } else if (message.codeGenFiles && message.codeGenFiles.length > 0) {
                                                            // Show sequential file display for code generation
                                                            return <SequentialCodeDisplay files={message.codeGenFiles} />;
                                                        } else {
                                                            return (
                                                                <div className="w-full max-w-full overflow-hidden">
                                                                    <MarkdownRenderer 
                                                                        content={message.text} 
                                                                        enableCodeTypewriter={!isUser && !isLog && message.text.includes('```')}
                                                                        onCodeTypewriterComplete={() => {
                                                                          console.log('Code typewriter completed for message', index);
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            className={`flex items-center justify-between text-xs px-3 pb-1.5 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                                        >
                                            <span className="font-mono">{displayTime}</span>
                                            {isUser && (
                                                <span className="flex items-center">
                                                    {message.status === "sending" ? <Loader2 size={10} className="animate-spin mr-1" /> : "✓"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Typing/Thinking indicator */}
                    {(isTyping || isThinking) && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="typing-indicator bg-muted text-foreground rounded-lg p-3 max-w-[95%] overflow-hidden"
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word', 
                                    overflowWrap: 'break-word'
                                }}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="bot-icon-container bg-muted-foreground/10 p-1 rounded-full mt-1">
                                        <Bot size={14} className="bot-icon text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {isThinking && thinkingMessage && (
                                            <div className="text-sm text-muted-foreground italic">
                                                {thinkingMessage}
                                            </div>
                                        )}
                                        <div className="flex space-x-1">
                                            <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse"></div>
                                            <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse delay-150"></div>
                                            <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse delay-300"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="input-area p-3 border-t border-border flex-shrink-0">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center gap-1 px-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="tool-button h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                                <Code size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="tool-button h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                                <Image size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="tool-button h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                                <Paperclip size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="tool-button h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                                <Plus size={14} />
                            </Button>
                            <div className="flex-1"></div>
                            <div className="char-count text-xs text-muted-foreground font-mono">
                                {input.length > 0 ? `${input.length} chars` : "gpt-4o"}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-background rounded-lg p-1 border border-border focus-within:ring-1 focus-within:ring-ring transition-all duration-200">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Message the AI Assistant"
                                className="chat-input flex-1 bg-transparent text-foreground px-2 py-1.5 min-h-[40px] max-h-[120px] resize-none focus:outline-none text-sm"
                                rows={1}
                            />

                            <Button
                                onClick={sendMessage}
                                disabled={input.trim() === ""}
                                className={`rounded-lg px-3 py-1.5 h-auto transition-all duration-200 ${
                                    input.trim() === ""
                                        ? "send-button-inactive bg-muted text-muted-foreground"
                                        : "send-button-active bg-primary hover:bg-primary/90 text-primary-foreground"
                                }`}
                            >
                                <Send size={12} className="mr-2" />
                                <span className="text-sm font-medium">Send</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Status bar */}
                <div className="status-bar px-4 py-1.5 border-t border-border flex items-center justify-between flex-shrink-0">
                    <div className="text-xs text-muted-foreground font-mono">v1.0.0</div>
                    <div className="flex items-center space-x-2">
                        <div className="status-online-dot w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-muted-foreground font-mono">ONLINE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Chat);