"use client";

import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
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
import { Button } from "@/components/ui/button";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import eventBus from '@/lib/eventBus';

// Icons
import { 
  Send, 
  Loader2, 
  X, 
  Maximize2, 
  Minimize2,
  Trash2
} from "lucide-react";
import MarkdownRenderer from '@/components/main/code/markdown/MarkdownRenderer';

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
  logs?: string[]; // Store logs as array for deduplication
  codeGenFiles?: Array<{
    filename: string;
    content: string;
    language: string;
  }>;
}

const Chat: React.FC = () => {
    const { projectContext } = useContext(ProjectContext);
    const { 
        selectedFile
    } = useContext(FileContext);

    const [additionalFiles] = useState<FileTreeItemType[]>([]);
    const [messages, setMessages] = useState<AIMessageType[]>([]);
    const [input, setInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingSteps, setThinkingSteps] = useState<Array<{text: string, completed: boolean}>>([]);
    const [currentThinkingStage, setCurrentThinkingStage] = useState<string | null>(null);
    const taskLogs = useTaskLogs();
    const { systemLogs } = taskLogs;
    const [lastLogIndex, setLastLogIndex] = useState(0);
    
    // Track processed logs to prevent duplicates
    const processedLogsRef = useRef(new Set<string>());
    const buildLogMessageIndexRef = useRef<number | null>(null);
    
  
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesAreaRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const scrollStateRef = useRef({
        userHasScrolledUp: false,
        lastScrollHeight: 0,
    });

    // Smart scroll to bottom function
    const scrollToBottom = useCallback((force = false) => {
        if (!messagesAreaRef.current) return;
        
        const container = messagesAreaRef.current;
        
        // Only scroll if user hasn't scrolled up, OR if forced (user message)
        if (force || !scrollStateRef.current.userHasScrolledUp) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, []);

    // Detect if user has manually scrolled
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const element = e.target as HTMLDivElement;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        
        // Check if user is near the bottom (within 50px tolerance)
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 50;
        
        // Update user scroll state
        scrollStateRef.current.userHasScrolledUp = !isNearBottom;
    }, []);

    // Auto-scroll when content changes
    useEffect(() => {
        if (!messagesAreaRef.current) return;
        
        const container = messagesAreaRef.current;
        const currentScrollHeight = container.scrollHeight;
        
        // If content height increased and user hasn't scrolled up
        if (currentScrollHeight > scrollStateRef.current.lastScrollHeight && 
            !scrollStateRef.current.userHasScrolledUp) {
            scrollToBottom();
        }
        
        scrollStateRef.current.lastScrollHeight = currentScrollHeight;
    }, [messages, scrollToBottom]);

    // Force scroll on user messages
    useEffect(() => {
        if (messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        
        // When a new user message is sent, reset scroll behavior and force scroll
        if (lastMessage.sender === 'user') {
            scrollStateRef.current.userHasScrolledUp = false;
            setTimeout(() => scrollToBottom(true), 100);
        }
    }, [messages, scrollToBottom]);

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

    // Process system logs and SSE events
    useEffect(() => {
        if (!systemLogs?.length) return;
        
        // Don't suppress logs during build, we want to see them
        const fresh = systemLogs.slice(lastLogIndex);
        
        if (fresh.length === 0) return;
        
        // Process logs and trigger thinking states
        fresh.forEach(line => {
            // Trigger appropriate thinking stage based on log content
            if (line.includes("Initializing deployment pipeline")) {
                showThinkingForStage('pipeline-init');
            } else if (line.includes("Validating project configuration")) {
                showThinkingForStage('validation');
            } else if (line.includes("Setting up Docker environment")) {
                showThinkingForStage('docker-setup');
            } else if (line.includes("Installing dependencies")) {
                showThinkingForStage('dependencies');
            } else if (line.includes("Generating program structure")) {
                showThinkingForStage('program-structure');
            } else if (line.includes("Writing instruction handlers")) {
                showThinkingForStage('instruction-handlers');
            } else if (line.includes("Creating account structures")) {
                showThinkingForStage('account-structures');
            } else if (line.includes("Generating TypeScript SDK")) {
                showThinkingForStage('typescript-sdk');
            } else if (line.includes("Building React components")) {
                showThinkingForStage('react-components');
            } else if (line.includes("Compiling Rust program")) {
                showThinkingForStage('rust-compilation');
            } else if (line.includes("Running security checks")) {
                showThinkingForStage('security-checks');
            } else if (line.includes("Optimizing bytecode")) {
                showThinkingForStage('optimization');
            } else if (line.includes("Generating program keypair")) {
                showThinkingForStage('keypair-generation');
            } else if (line.includes("Creating deployment artifacts")) {
                showThinkingForStage('artifacts');
            } else if (line.includes("Finalizing build")) {
                showThinkingForStage('finalization');
            } else if (line.includes("Build completed successfully")) {
                showThinkingForStage('completion');
            }
        });
        
        // Filter and deduplicate logs
        const newLogs = fresh.filter(log => {
            // Create a unique key for this log
            const logKey = log.trim();
            
            // Skip if already processed
            if (processedLogsRef.current.has(logKey)) {
                return false;
            }
            
            // Skip certain types of logs
            if (log.includes('Program ID:') || 
                log.includes('[...] Program ID:') ||
                log.trim() === '') {
                return false;
            }
            
            // Mark as processed
            processedLogsRef.current.add(logKey);
            return true;
        });
        
        // Update or create the build log message
        if (newLogs.length > 0) {
            setMessages(prev => {
                // Find existing build log message or create new one
                if (buildLogMessageIndexRef.current !== null && 
                    prev[buildLogMessageIndexRef.current]) {
                    // Update existing message
                    const updated = [...prev];
                    const existingMessage = updated[buildLogMessageIndexRef.current];
                    const existingLogs = existingMessage.logs || [];
                    
                    updated[buildLogMessageIndexRef.current] = {
                        ...existingMessage,
                        logs: [...existingLogs, ...newLogs],
                        timestamp: new Date()
                    };
                    
                    return updated;
                } else {
                    // Create new build log message
                    const newMessage: AIMessageType = {
                        text: '',
                        sender: 'ai',
                        timestamp: new Date(),
                        status: 'sent',
                        logs: newLogs
                    };
                    
                    buildLogMessageIndexRef.current = prev.length;
                    return [...prev, newMessage];
                }
            });
        }
        
        setLastLogIndex(systemLogs.length);
    }, [systemLogs, lastLogIndex]);


    // Handle build completion
    useEffect(() => {
        const onComplete = () => {
            setIsThinking(false);
            setCurrentThinkingStage(null);
            buildLogMessageIndexRef.current = null;
            taskLogs.setSuppressToast(false);
        };
        
        eventBus.on("build-complete", onComplete);
        
        return () => {
            eventBus.off("build-complete", onComplete);
        };
    }, [taskLogs]);

    const { publicKey, connected } = useWallet();

    const sendMessage = async () => {
        const trimmed = input.trim().toLowerCase();

        if (trimmed === 'build') {
            taskLogs.setSuppressToast(true);
            processedLogsRef.current.clear();
            buildLogMessageIndexRef.current = null;

            setMessages(prev => [
                ...prev,
                { text: input, sender: 'user', timestamp: new Date(), status: 'sent' }
            ]);
            
            setInput('');
            showThinkingForStage('pipeline-init');
            console.log('[CHAT-DEBUG] Emitting chat-build-command');
            eventBus.emit('chat-build-command');
            return;
        }
        
        if (input.trim()) {
            const selectedFiles = [selectedFile, ...additionalFiles].filter(
                (file): file is FileTreeItemType => Boolean(file)
            );

            setMessages([...messages, { 
                text: input, 
                sender: 'user',
                files: selectedFiles,
                timestamp: new Date(),
                status: 'sending'
            }]);

            setInput('');
            setIsTyping(true);

            try {
                const fileTasks = await Promise.all(
                    selectedFiles.map(async (file) => {
                        if (file.path && projectContext.id) {
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
                            return {
                                path: fileTask.filePath,
                                content: content || 'No content available',
                            };
                        }
                        return { path: 'Unknown path', content: 'No content available' };
                    })
                );

                const userPublicKeyString = connected && publicKey ? publicKey.toBase58() : '';

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

                setMessages(prevMessages => [
                    ...prevMessages,
                    {
                        text: responseText,
                        sender: 'ai',
                        timestamp: new Date(),
                        status: 'sent'
                    },
                ]);
            } catch (error) {
                setIsTyping(false);
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

    const formatTime = (dateValue?: Date | string) => {
        if (!dateValue) return "";
        const dateObj = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
        return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const clearChat = () => {
        setMessages([]);
        processedLogsRef.current.clear();
        buildLogMessageIndexRef.current = null;
        sessionStorage.removeItem('chatMessages');
        localStorage.removeItem('chatMessages');
    };

    const showThinkingForStage = async (stage: string) => {
        if (currentThinkingStage === stage) return;
        setCurrentThinkingStage(stage);
        
        setIsThinking(true);
        
        const stageThoughts = {
            'pipeline-init': [
                "Initializing Solana deployment pipeline...",
                "Allocating computational resources for build process",
                "Preparing secure isolated environment",
                "Loading project configuration and dependencies"
            ],
            'validation': [
                "Validating project structure and configuration",
                "Checking workflow graph integrity",
                "Verifying instruction dependencies",
                "Analyzing account relationships"
            ],
            'docker-setup': [
                "Spinning up Docker container with Solana toolchain",
                "Mounting project workspace securely",
                "Configuring container networking",
                "Setting up build cache for optimization"
            ],
            'dependencies': [
                "Installing Rust stable toolchain",
                "Setting up Solana BPF target support",
                "Installing Anchor framework v0.30",
                "Configuring Solana CLI tools"
            ],
            'program-structure': [
                "Analyzing workflow to generate optimal program structure",
                "Designing modular instruction architecture",
                "Planning account data layouts",
                "Calculating rent-exempt reserve requirements"
            ],
            'instruction-handlers': [
                "Generating instruction handler functions",
                "Implementing input validation logic",
                "Adding security checks and constraints",
                "Creating error handling mechanisms"
            ],
            'account-structures': [
                "Creating account data structures",
                "Implementing serialization/deserialization",
                "Optimizing storage layout for efficiency",
                "Adding account validation rules"
            ],
            'typescript-sdk': [
                "Generating TypeScript SDK for frontend integration",
                "Creating type definitions and interfaces",
                "Building transaction helper functions",
                "Implementing wallet adapter integration"
            ],
            'react-components': [
                "Creating React hooks for program interaction",
                "Building UI components for transactions",
                "Setting up state management utilities",
                "Generating example usage patterns"
            ],
            'rust-compilation': [
                "Compiling Rust source to BPF bytecode",
                "Linking Solana runtime dependencies",
                "Processing macro expansions",
                "Building program binary"
            ],
            'security-checks': [
                "Running static security analysis",
                "Checking for common vulnerabilities",
                "Validating access control patterns",
                "Verifying arithmetic operations"
            ],
            'optimization': [
                "Optimizing bytecode for size constraints",
                "Reducing compute unit consumption",
                "Minimizing account data usage",
                "Applying compiler optimizations"
            ],
            'keypair-generation': [
                "Generating deterministic program keypair",
                "Computing program derived addresses",
                "Creating deployment configuration",
                "Setting up program authority"
            ],
            'artifacts': [
                "Packaging compiled program binary",
                "Generating Interface Definition Language",
                "Creating deployment metadata",
                "Building distribution artifacts"
            ],
            'finalization': [
                "Performing final validation checks",
                "Verifying all build artifacts",
                "Generating deployment instructions",
                "Preparing success summary"
            ],
            'completion': [
                "Build pipeline completed successfully! ✅",
                "All artifacts generated and validated",
                "Program ready for deployment",
                "You can now deploy to devnet or mainnet"
            ]
        };
        
        const thoughts = stageThoughts[stage as keyof typeof stageThoughts] || [
            "Processing...",
            "Analyzing requirements...",
            "Generating code...",
            "Finalizing..."
        ];
        
        setThinkingSteps([]);
        
        for (const [index, thought] of thoughts.entries()) {
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
            
            setThinkingSteps(prev => [...prev, { text: thought, completed: false }]);
            
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
            setThinkingSteps(prev => prev.map((step, i) => 
                i === index ? { ...step, completed: true } : step
            ));
        }
        
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsThinking(false);
        setThinkingSteps([]);
        setCurrentThinkingStage(null);
    };

    return (
        <div
            className={`flex flex-col h-full ${isExpanded ? "fixed inset-4 z-50" : ""} transition-all duration-300 ease-in-out`}
        >
            <div 
                className="chat-container flex flex-col h-full bg-card border-border overflow-hidden w-full"
            >
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

                <div 
                    ref={messagesAreaRef}
                    className="messages-area text-sm flex-1 overflow-y-auto p-6 space-y-6 min-h-0"
                    onScroll={handleScroll}
                >
                    <AnimatePresence>
                        {messages.map((message, index) => {
                            const isUser = message.sender === 'user';
                            const displayTime = message.timestamp
                                ? formatTime(message.timestamp)
                                : "";
                            
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className={`w-full ${isUser ? "flex justify-end" : ""}`}
                                >
                                    <div
                                        className={`${
                                            isUser
                                                ? "user-message bg-gray-900/20 rounded-lg px-4 py-3 max-w-[80%] shadow-sm"
                                                : "w-full"
                                        } overflow-hidden`}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word', 
                                            overflowWrap: 'break-word'
                                        }}
                                    >
                                        <div className="w-full">
                                            <div className="flex items-start gap-3 w-full">
                                                <div className="leading-relaxed w-full min-w-0 flex-1">
                                                    {message.logs && message.logs.length > 0 ? (
                                                        <div className="space-y-1 font-mono text-xs text-gray-400">
                                                            {message.logs.map((log, logIndex) => (
                                                                <div key={logIndex} className="opacity-80">
                                                                    {log}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full max-w-full overflow-hidden">
                                                            <MarkdownRenderer 
                                                                content={message.text}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {displayTime && (
                                            <div className={`text-xs mt-2 ${isUser ? "text-gray-500" : "text-gray-500"}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{displayTime}</span>
                                                    {isUser && (
                                                        <span className="flex items-center">
                                                            {message.status === "sending" ? <Loader2 size={10} className="animate-spin mr-1" /> : "✓"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>


                    {isThinking && thinkingSteps.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full"
                        >
                            <div className="thinking-steps space-y-2">
                                {thinkingSteps.map((step, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center gap-2 text-gray-500 text-sm"
                                    >
                                        <Loader2 
                                            size={12} 
                                            className={step.completed ? "text-green-500" : "animate-spin"}
                                        />
                                        <span className={`text-sm ${step.completed ? "text-gray-400" : "text-gray-500"}`}>
                                            {step.text}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {isTyping && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full"
                        >
                            <div className="flex items-center gap-3">
                                <Loader2 size={16} className="animate-spin text-cyan-500" />
                                <span className="text-sm text-gray-500 italic">AI is thinking...</span>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="input-area p-3 border-t border-border flex-shrink-0">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-end px-2">
                            <div className="char-count text-xs text-muted-foreground font-mono">
                                {input.length > 0 ? `${input.length} chars` : "Claude AI"}
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