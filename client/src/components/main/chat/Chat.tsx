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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTaskLogs } from "@/context/logs/useTaskLogs";
import eventBus from '@/lib/eventBus';

// Icons
import { 
  Send, 
  Bot, 
  Loader2, 
  X, 
  Maximize2, 
  Minimize2,
  Trash2
} from "lucide-react";
import MarkdownRenderer from '@/components/main/code/markdown/MarkdownRenderer';
import ChatChecklistBubble from './ChatChecklistBubble';
import SequentialCodeDisplay from './SequentialCodeDisplay';
import { debugLogger } from '@/utils/debugLogger';

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
    const taskLogs = useTaskLogs();  // Complete taskLogs object including systemLogs and setSuppressToast
    const { systemLogs } = taskLogs;
    const [lastLogIndex, setLastLogIndex] = useState(0);  // 🟡 NEW
    const [userHasScrolled, setUserHasScrolled] = useState(false); // Track if user manually scrolled
  
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesAreaRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const contentHeightRef = useRef(0);
    const isAutoScrollingRef = useRef(false);
    const scrollStateRef = useRef({
        isScrolling: false,
        lastScrollTime: 0,
        userScrollPosition: -1,  // Track user's scroll position
        autoScrollEnabled: true  // Whether auto-scroll is enabled
    });


    // Smart scroll that respects user position
    const smartScrollToBottom = useCallback(() => {
        // Only scroll if auto-scroll is enabled
        if (!scrollStateRef.current.autoScrollEnabled) {
            return;
        }
        
        if (messagesAreaRef.current) {
            const container = messagesAreaRef.current;
            const targetScroll = container.scrollHeight - container.clientHeight;
            
            // Smooth scroll to bottom
            requestAnimationFrame(() => {
                container.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
            });
        }
    }, []);
    
    // Force scroll only for critical messages (user messages, errors)
    const forceScrollToBottom = useCallback(() => {
        if (messagesAreaRef.current) {
            const container = messagesAreaRef.current;
            container.scrollTop = container.scrollHeight;
            scrollStateRef.current.autoScrollEnabled = true;
            setUserHasScrolled(false);
        }
    }, []);
    
    // Keep compatibility
    const smoothScrollToBottom = smartScrollToBottom;
    const stableScrollToBottom = smartScrollToBottom;

    // Enhanced scroll detection that properly respects user intent
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const element = e.target as HTMLDivElement;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        
        // Calculate if user is near bottom (within 100px tolerance)
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
        
        // If user scrolled up significantly, disable auto-scroll
        if (!isNearBottom && scrollTop < scrollStateRef.current.userScrollPosition - 50) {
            scrollStateRef.current.autoScrollEnabled = false;
            setUserHasScrolled(true);
        }
        // Re-enable auto-scroll if user scrolls back to bottom
        else if (isNearBottom) {
            scrollStateRef.current.autoScrollEnabled = true;
            setUserHasScrolled(false);
        }
        
        scrollStateRef.current.userScrollPosition = scrollTop;
    }, []);

    // Replace MutationObserver with more controlled approach
    useEffect(() => {
        if (messagesAreaRef.current) {
            let observerTimeout: NodeJS.Timeout | null = null;
            let lastHeight = 0;
            
            const observer = new MutationObserver((mutations) => {
                // Clear existing timeout
                if (observerTimeout) clearTimeout(observerTimeout);
                
                // Heavy debounce - only process after 200ms of no changes
                observerTimeout = setTimeout(() => {
                    const currentHeight = messagesAreaRef.current?.scrollHeight || 0;
                    
                    // Only scroll if height actually changed significantly
                    if (Math.abs(currentHeight - lastHeight) > 100) {
                        lastHeight = currentHeight;
                        stableScrollToBottom();
                    }
                }, 200); // Increased debounce
            });
            
            observer.observe(messagesAreaRef.current, {
                childList: true,
                subtree: false, // Don't watch deep changes
                characterData: false,
                attributes: false
            });
            
            return () => {
                if (observerTimeout) clearTimeout(observerTimeout);
                observer.disconnect();
            };
        }
    }, [stableScrollToBottom]);

    // Fix message scrolling for user vs AI messages
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            
            // Only force scroll for user messages or critical AI responses
            if (lastMessage.sender === 'user') {
                // Always scroll to bottom for user messages
                scrollStateRef.current.autoScrollEnabled = true;
                setUserHasScrolled(false);
                setTimeout(forceScrollToBottom, 100);
            } else if (lastMessage.sender === 'ai') {
                // For AI messages, only auto-scroll if user hasn't scrolled up
                if (!userHasScrolled) {
                    setTimeout(smartScrollToBottom, 100);
                }
            }
        }
    }, [messages, userHasScrolled, forceScrollToBottom, smartScrollToBottom]);

    useEffect(() => {
        smartScrollToBottom();
    }, [isTyping, isThinking, smartScrollToBottom]);

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
    //  Debounced system log processing to prevent UI flickering
    // ───────────────────────────────────────────────────────────────────────────
    const processedEventsRef = useRef(new Set<string>());
    const logProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastCodeGenSequenceRef = useRef<number>(0);

    useEffect(() => {
        if (!systemLogs?.length) return;
        
        // Suppress log spam while building
        if (taskLogs.isBuilding || messages.some(m => m.isChecklist)) {
          setLastLogIndex(systemLogs.length); // swallow logs
          return;
        }

        // Clear existing timeout to debounce processing
        if (logProcessingTimeoutRef.current) {
            clearTimeout(logProcessingTimeoutRef.current);
        }

        // Schedule batched processing after 150ms debounce
        logProcessingTimeoutRef.current = setTimeout(() => {
            const fresh = systemLogs.slice(lastLogIndex);

            // Enhanced filtering with regex patterns for Program IDs
            const IGNORE_PREFIXES = [
                "Preparing your build environment",
                "Container is up", 
                "Container URL",
                "Building program",
                "Linking target/deploy",
                "Collecting project files"
            ];
            
            const IGNORE_PATTERNS = [
                /Program ID: \w+/,
                /8u9EqQfPNdaCkPFNLpJwTboQQGxwXsb1V7TNeY44qEd/,  // Your specific program ID
                /[A-Za-z0-9]{32,44}$/,  // Generic base58 program IDs
                /Generated program keypair/,
                /\[\.\.\.\] Program ID:/,
                /IDL metadata.*address/
            ];

            const visible = fresh.filter(line => 
                !IGNORE_PREFIXES.some(p => line.includes(p)) &&
                !IGNORE_PATTERNS.some(pattern => 
                    typeof pattern === 'string' ? line.includes(pattern) : pattern.test(line)
                )
            );

            if (visible.length) {
                console.log('[CHAT] ====== PROCESSING BATCHED SYSTEM LOGS ======');
                console.log('[CHAT] Processing', visible.length, 'new lines');
                
                const newLogMessages: AIMessageType[] = [];
                let hasCodeGenUpdate = false;
                let latestCodeGenFiles: any[] = [];
                
                for (const line of visible) {
                    // Create unique key for deduplication
                    const lineKey = `${line.substring(0, 100)}_${Date.now()}`;
                    if (processedEventsRef.current.has(lineKey)) continue;
                    processedEventsRef.current.add(lineKey);
                    
                    // Add more thinking triggers based on log content
                    if (line.includes("Starting Docker container")) {
                        showThinkingForStage('environment');
                    } else if (line.includes("Generating") && line.includes("files")) {
                        showThinkingForStage('codegen-files');
                    } else if (line.includes("Compilation progress")) {
                        showThinkingForStage('build-progress');
                    } else if (line.includes("Build completed successfully")) {
                        showThinkingForStage('deployment-ready');
                    } else if (line.includes("Preparing your build environment")) {
                        showThinkingForStage('environment');
                    } else if (line.includes("Building program")) {
                        showThinkingForStage('build');
                    } else if (line.includes("cargo build-sbf")) {
                        showThinkingForStage('build');
                    } else if (line.includes("Compiling") && line.includes("Rust")) {
                        showThinkingForStage('build-progress');
                    } else if (line.includes("TypeScript bindings")) {
                        showThinkingForStage('codegen');
                    } else if (line.includes("Program ID generated")) {
                        showThinkingForStage('deployment-ready');
                    }
                    
                    // Handle JSON messages
                    try {
                        if (line.startsWith('{') && line.includes('type')) {
                            const parsed = JSON.parse(line);
                            
                            // Handle batched code generation events
                            if (parsed.type === 'code-generation-batch' && parsed.files?.length > 0) {
                                // Deduplicate by sequence number
                                if (parsed.sequence && parsed.sequence > lastCodeGenSequenceRef.current) {
                                    console.log('[CHAT] ====== BATCHED CODE GENERATION ======');
                                    console.log('[CHAT] Files:', parsed.files.length);
                                    
                                    hasCodeGenUpdate = true;
                                    latestCodeGenFiles = parsed.files;
                                    lastCodeGenSequenceRef.current = parsed.sequence;
                                    
                                    showThinkingForStage('codegen');
                                }
                                continue;
                            }
                            
                            // Handle individual code generation (legacy support)
                            if (parsed.type === 'code-generation' && parsed.files?.length > 0) {
                                console.log('[CHAT] ====== INDIVIDUAL CODE GENERATION ======');
                                hasCodeGenUpdate = true;
                                latestCodeGenFiles = [...latestCodeGenFiles, ...parsed.files];
                                showThinkingForStage('codegen');
                                continue;
                            }
                            
                            // Skip progress messages to avoid conflicts
                            if (parsed.type === 'progress' && parsed.pct !== undefined) {
                                continue;
                            }
                        }
                    } catch (e) {
                        // Filter out progress lines
                        if (line.includes('%') && (line.includes('Building') || line.includes('Generating'))) {
                            continue;
                        }
                        
                        if (line.includes('Collecting project files') || line.includes('Preparing files')) {
                            continue;
                        }
                    }
                    
                    // Add regular log lines (filtered)
                    if (!taskLogs.isBuilding || line.includes('ERROR') || line.includes('WARN')) {
                        newLogMessages.push({
                            text: line,
                            sender: 'ai',
                            timestamp: new Date(),
                            status: 'sent',
                            isLogLine: true,
                        });
                    }
                }

                // Batch update messages
                if (hasCodeGenUpdate || newLogMessages.length > 0) {
                    console.log('[CHAT] ====== BATCH UPDATE ======');
                    
                    setMessages(prev => {
                        let updated = [...prev];
                        
                        // Add/update code generation message
                        if (hasCodeGenUpdate && latestCodeGenFiles.length > 0) {
                            // Remove existing code-gen messages
                            updated = updated.filter(m => !m.codeGenFiles);
                            
                            // Add new consolidated code gen message
                            updated.push({
                                text: '',
                                sender: 'ai' as const,
                                timestamp: new Date(),
                                status: 'sent' as const,
                                codeGenFiles: latestCodeGenFiles
                            });
                        }
                        
                        // Add regular log messages
                        if (newLogMessages.length > 0) {
                            updated.push(...newLogMessages);
                        }
                        
                        return updated;
                    });
                    
                    setUserHasScrolled(false);
                    setTimeout(() => smartScrollToBottom(), 100);
                }
                
                setLastLogIndex(systemLogs.length);
            }
        }, 150); // 150ms debounce

        // Cleanup timeout on unmount
        return () => {
            if (logProcessingTimeoutRef.current) {
                clearTimeout(logProcessingTimeoutRef.current);
            }
        };
    }, [systemLogs, lastLogIndex, taskLogs.isBuilding, messages]);

    // Add comprehensive debugging to trace ALL events
    useEffect(() => {
        const logAllEvents = (eventName: string) => {
            return (data: any) => {
                console.log(`[CHAT-DEBUG] Event "${eventName}":`, data);
                if (data.type === 'code-generation') {
                    console.log('[CHAT-DEBUG] 🎯 CODE-GENERATION EVENT DETECTED!');
                    console.log('[CHAT-DEBUG] Files count:', data.files?.length || 0);
                    console.log('[CHAT-DEBUG] Files:', data.files?.map((f: any) => f.filename));
                }
            };
        };
        
        eventBus.on('progress', logAllEvents('progress'));
        eventBus.on('code-generation', logAllEvents('code-generation'));
        eventBus.on('file-written', logAllEvents('file-written'));
        
        return () => {
            eventBus.off('progress', logAllEvents('progress'));
            eventBus.off('code-generation', logAllEvents('code-generation'));
            eventBus.off('file-written', logAllEvents('file-written'));
        };
    }, []);

    // Remove duplicate SSE listeners - now handled by ChatChecklistBubble via useChecklistProgress


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

          // 4) Show AI thinking state with structured thoughts
          await showThinkingForStage('initial-build');
          
          // 5) Brief pause before showing checklist
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
    // Show thinking states for different build phases
    const showThinkingForStage = async (stage: string) => {
      // Prevent duplicate thinking states
      if (currentThinkingStage === stage) return;
      setCurrentThinkingStage(stage);
      
      setIsThinking(true);
      
      const stageThoughts = {
        'initial-build': [
          "🔍 Analyzing project structure...",
          "📋 Validating Anchor.toml configuration...",
          "🔧 Checking Rust toolchain compatibility...",
          "📦 Scanning dependencies and versions...",
          "🎯 Identifying program entry points...",
          "⚡ Planning optimal build strategy...",
          "🐳 Preparing Docker container...",
          "⏱️ Estimated time: 2-3 minutes"
        ],
        'environment': [
          "🐳 Starting Docker container...",
          "🔄 Mounting project volumes...",
          "🦀 Installing Rust 1.75.0...",
          "⚓ Setting up Anchor framework v0.30...",
          "🔗 Configuring Solana CLI tools...",
          "📚 Loading build dependencies...",
          "💾 Initializing build cache...",
          "✅ Container ready for compilation"
        ],
        'codegen': [
          "📝 Parsing program instructions...",
          "🔍 Analyzing account structures...",
          "🏗️ Generating TypeScript bindings...",
          "⚛️ Creating React components...",
          "🔌 Building wallet adapter hooks...",
          "🎨 Generating UI components...",
          "📄 Creating IDL definitions...",
          "🚀 Optimizing for production..."
        ],
        'codegen-files': [
          "📄 Creating lib.rs with program logic...",
          "📄 Generating instruction handlers...",
          "🔐 Setting up account validators...",
          "🎯 Building state management...",
          "💼 Creating wallet integration...",
          "🌐 Generating API endpoints...",
          "📊 Building data structures..."
        ],
        'build': [
          "🔨 Starting cargo build-sbf...",
          "🦀 Compiling Rust to BPF bytecode...",
          "⚡ Optimizing for Solana runtime...",
          "🔑 Generating program keypair...",
          "📦 Creating deployment package...",
          "🔍 Running safety checks...",
          "📋 Generating IDL metadata...",
          "✨ Finalizing build artifacts..."
        ],
        'build-progress': [
          "📊 Compilation progress: 25%...",
          "⚙️ Linking dependencies...",
          "📊 Compilation progress: 50%...",
          "🔧 Optimizing bytecode...",
          "📊 Compilation progress: 75%...",
          "🎯 Finalizing program binary...",
          "📊 Compilation progress: 95%...",
          "✅ Build verification complete"
        ],
        'deployment-ready': [
          "🎉 Build completed successfully!",
          "📦 Artifacts ready for deployment",
          "🔑 Program ID generated",
          "🌐 Frontend connected to program",
          "✨ Ready to deploy to Solana!"
        ]
      };
      
      const thoughts = stageThoughts[stage as keyof typeof stageThoughts] || [];
      setThinkingSteps([]);
      
      // Progressive reveal with better timing
      for (const [index, thought] of thoughts.entries()) {
        // Initial delay before showing thought
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
        
        // Add the thought as pending
        setThinkingSteps(prev => [...prev, { text: thought, completed: false }]);
        
        // Mark as completed after a delay
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
        setThinkingSteps(prev => prev.map((step, i) => 
          i === index ? { ...step, completed: true } : step
        ));
      }
      
      // Keep final state visible briefly
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsThinking(false);
      setThinkingSteps([]);
      setCurrentThinkingStage(null);
    };

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
                    className="messages-area text-sm flex-1 overflow-y-auto p-6 space-y-6 min-h-0"
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
                                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className={`w-full ${isUser ? "" : "border-l-2 border-gray-700"} py-4 ${isUser ? "flex justify-end" : "pl-4"}`}
                                >
                                    <div
                                        className={`${
                                            isUser
                                                ? "user-message bg-gray-900/20 rounded-lg px-4 py-3 max-w-[80%] shadow-sm"
                                                : isLog
                                                  ? "log-message text-foreground w-full font-mono text-sm text-gray-400 opacity-80"
                                                  : "w-full"
                                        } overflow-hidden`}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word', 
                                            overflowWrap: 'break-word'
                                        }}
                                    >
                                        <div className={`${isUser ? "" : ""} w-full`}>
                                            <div className="flex items-start gap-3 w-full">
                                                {!isUser && !isLog && (
                                                    <div className="ai-avatar mt-1 flex-shrink-0">
                                                        <Bot size={16} className="text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="leading-relaxed w-full min-w-0 flex-1">
                                                    {/* Render message content */}
                                                    {(() => {
                                                        console.log(`[RENDER] Message ${index} render check:`, {
                                                            isChecklist: message.isChecklist,
                                                            hasCodeGenFiles: !!message.codeGenFiles,
                                                            fileCount: message.codeGenFiles?.length || 0,
                                                            sender: message.sender,
                                                            textPreview: message.text?.substring(0, 30) || 'empty'
                                                        });
                                                        
                                                        if (message.isChecklist) {
                                                            console.log('[RENDER] Rendering ChatChecklistBubble');
                                                            return <ChatChecklistBubble />;
                                                        } else if (message.codeGenFiles && message.codeGenFiles.length > 0) {
                                                            console.log('[RENDER] ================ RENDERING SequentialCodeDisplay ================');
                                                            console.log('[RENDER] Files to display:', message.codeGenFiles.map((f: any) => ({ 
                                                                filename: f.filename, 
                                                                contentLength: f.content?.length || 0,
                                                                language: f.language 
                                                            })));
                                                            console.log('[RENDER] Component will be mounted with', message.codeGenFiles.length, 'files');
                                                            
                                                            return <SequentialCodeDisplay files={message.codeGenFiles} />;
                                                        } else {
                                                            console.log('[RENDER] Rendering MarkdownRenderer for text message');
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
                                        {/* Timestamp */}
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
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Typing/Thinking indicator */}
                    {(isTyping || isThinking) && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full border-l-2 border-gray-600/50 pl-4 py-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="ai-avatar mt-1">
                                    <Bot size={16} className="text-gray-400" />
                                </div>
                                <div className="flex-1">
                                    {isThinking && thinkingSteps.length > 0 ? (
                                        <div className="thinking-steps space-y-2">
                                            {thinkingSteps.map((step, index) => (
                                                <motion.div
                                                    key={index}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="flex items-center gap-2 text-gray-500 text-sm"
                                                >
                                                    <span className="text-sm">
                                                        {step.completed ? '●' : '○'}
                                                    </span>
                                                    <span className="text-sm">{step.text}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-500 italic">Thinking...</span>
                                            <div className="flex space-x-1">
                                                {[0, 1, 2].map(i => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-2 h-2 bg-gray-400 rounded-full"
                                                        animate={{
                                                            scale: [1, 1.2, 1],
                                                            opacity: [0.3, 1, 0.3]
                                                        }}
                                                        transition={{
                                                            duration: 1.5,
                                                            repeat: Infinity,
                                                            delay: i * 0.2
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
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