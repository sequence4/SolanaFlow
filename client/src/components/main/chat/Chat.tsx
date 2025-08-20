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
            console.log('[CHAT] ====== PROCESSING SYSTEM LOGS ======');
            console.log('[CHAT] Processing', visible.length, 'new lines');
            console.log('[CHAT] Lines:', visible);
            
            const logMessages: AIMessageType[] = [];
            
            for (const line of visible) {
                console.log('[CHAT] Processing line:', line);
                
                // Detect different build phases and show thinking states
                if (line.includes("Preparing your build environment")) {
                    console.log('[CHAT] Detected environment setup phase');
                    showThinkingForStage('environment');
                } else if (line.includes("Building program")) {
                    console.log('[CHAT] Detected build phase');
                    showThinkingForStage('build');
                }
                
                // Check if this is a JSON message first
                try {
                    if (line.startsWith('{') && line.includes('type')) {
                        const parsed = JSON.parse(line);
                        console.log('[CHAT] Parsed JSON message:', parsed);
                        
                        // Check for code generation messages with files
                        if (parsed.type === 'code-generation' && parsed.files && parsed.files.length > 0) {
                            console.log('[CHAT] ====== CODE GENERATION DETECTED ======');
                            console.log('[CHAT] Found code-generation message with', parsed.files.length, 'files');
                            console.log('[CHAT] Files:', parsed.files.map((f: any) => f.filename));
                            
                            // Show thinking state for code generation
                            console.log('[CHAT] Triggering codegen thinking state...');
                            showThinkingForStage('codegen');
                            
                            // IMMEDIATELY add to messages, don't wait for batch
                            setMessages(prev => {
                                // Remove any existing code-gen messages to avoid duplicates
                                const filtered = prev.filter(m => !m.codeGenFiles);
                                console.log('[CHAT] Filtered out previous code-gen messages, remaining:', filtered.length);
                                
                                const newMessage = {
                                    text: '', // Empty text, let SequentialCodeDisplay handle the display
                                    sender: 'ai' as const,
                                    timestamp: new Date(),
                                    status: 'sent' as const,
                                    codeGenFiles: parsed.files
                                };
                                
                                console.log('[CHAT] Adding code gen message IMMEDIATELY to chat');
                                console.log('[CHAT] Total messages after immediate update will be:', filtered.length + 1);
                                return [...filtered, newMessage];
                            });
                            
                            // Reset user scroll state when new messages arrive
                            setUserHasScrolled(false);
                            // Smart scroll to bottom
                            setTimeout(() => smartScrollToBottom(), 100);
                            
                            // DON'T add to logMessages - we already added directly
                            continue; // Skip the rest of the loop
                        }
                        
                        // Skip progress-only messages during code generation to avoid conflicts
                        if (parsed.type === 'progress' && parsed.message && parsed.pct !== undefined) {
                            console.log('[CHAT] Skipping progress message to avoid conflicts:', parsed.message, 'at', parsed.pct + '%');
                            continue;
                        }
                    }
                } catch (e) {
                    // Not JSON, check if it's a progress percentage line
                    if (line.includes('%') && (line.includes('Building') || line.includes('Generating'))) {
                        console.log('[CHAT] Skipping progress line:', line);
                        continue;
                    }
                    
                    // Skip any other lines that might interfere with code generation display
                    if (line.includes('Collecting project files') || line.includes('Preparing files')) {
                        console.log('[CHAT] Skipping file preparation line:', line);
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
                console.log('[CHAT] ====== ADDING MESSAGES TO CHAT ======');
                console.log('[CHAT] Adding', logMessages.length, 'new messages to chat');
                console.log('[CHAT] New messages:', logMessages.map(m => ({
                    sender: m.sender,
                    hasCodeGenFiles: !!m.codeGenFiles,
                    fileCount: m.codeGenFiles?.length || 0,
                    isChecklist: m.isChecklist,
                    textPreview: m.text.substring(0, 50)
                })));
                setMessages(prev => {
                    const newMessages = [...prev, ...logMessages];
                    console.log('[CHAT] Total messages after update:', newMessages.length);
                    console.log('[CHAT] Messages with codeGenFiles:', newMessages.filter(m => m.codeGenFiles).length);
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

    // Add direct SSE listener to bypass systemLogs for code-generation
    useEffect(() => {
        const handleSSEProgress = (data: any) => {
            console.log('[CHAT-SSE] Direct SSE progress event:', data);
            
            // Check for code-generation messages with files
            if (data.type === 'code-generation' && data.files && data.files.length > 0) {
                console.log('[CHAT-SSE] ✅ CODE GENERATION FILES RECEIVED!', data.files.length, 'files');
                console.log('[CHAT-SSE] Files:', data.files.map((f: any) => f.filename));
                
                // IMMEDIATELY add to chat messages
                setMessages(prev => {
                    const filtered = prev.filter(m => !m.codeGenFiles);
                    const newMessage = {
                        text: '',
                        sender: 'ai' as const,
                        timestamp: new Date(),
                        status: 'sent' as const,
                        codeGenFiles: data.files
                    };
                    
                    console.log('[CHAT-SSE] Adding code files to chat NOW');
                    return [...filtered, newMessage];
                });
                
                setUserHasScrolled(false);
                setTimeout(() => smartScrollToBottom(), 100);
            }
        };
        
        // Listen to the progress event that comes from SSE
        eventBus.on('progress', handleSSEProgress);
        
        // Also listen to direct code-generation events
        const handleDirectCodeGeneration = (data: any) => {
            console.log('[CHAT] ====== DIRECT CODE-GEN EVENT RECEIVED ======');
            console.log('[CHAT] Event data:', data);
            
            if (data.type === 'code-generation' && data.files && data.files.length > 0) {
                console.log('[CHAT] Processing direct code-gen event with', data.files.length, 'files');
                
                // Add immediately to messages
                setMessages(prev => {
                    const filtered = prev.filter(m => !m.codeGenFiles);
                    const newMessage = {
                        text: '',
                        sender: 'ai' as const,
                        timestamp: new Date(),
                        status: 'sent' as const,
                        codeGenFiles: data.files
                    };
                    
                    console.log('[CHAT] Adding direct code-gen message to chat');
                    return [...filtered, newMessage];
                });
                
                setUserHasScrolled(false);
                setTimeout(() => smartScrollToBottom(), 100);
            }
        };
        
        eventBus.on('code-generation', handleDirectCodeGeneration);
        
        return () => {
            eventBus.off('progress', handleSSEProgress);
            eventBus.off('code-generation', handleDirectCodeGeneration);
        };
    }, []);


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
          "Scanning project directory structure...",
          "Located Cargo.toml at /app",
          "Detecting Solana program architecture...", 
          "Found 3 instruction handlers in lib.rs",
          "Analyzing dependencies: anchor-lang v0.30.1",
          "Preparing containerized build environment...",
          "Estimating build time: ~2 minutes"
        ],
        'environment': [
          "Initializing Docker container...",
          "Loading Solana build tools...",
          "Configuring Rust toolchain...",
          "Setting up workspace dependencies..."
        ],
        'codegen': [
          "Analyzing program structure...",
          "Generating instruction handlers...",
          "Creating account definitions...",
          "Building state management logic...",
          "Optimizing for Solana runtime..."
        ],
        'build': [
          "Compiling Rust source files...",
          "Linking Solana BPF modules...",
          "Optimizing bytecode...",
          "Generating deployment artifacts..."
        ]
      };
      
      const thoughts = stageThoughts[stage as keyof typeof stageThoughts] || [];
      setThinkingSteps([]);
      
      for (const [index, thought] of thoughts.entries()) {
        await new Promise(resolve => setTimeout(resolve, 150));
        setThinkingSteps(prev => [...prev, { text: thought, completed: false }]);
        await new Promise(resolve => setTimeout(resolve, 200));
        setThinkingSteps(prev => prev.map((step, i) => 
          i === index ? { ...step, completed: true } : step
        ));
      }
      
      // Clear thinking after brief pause
      await new Promise(resolve => setTimeout(resolve, 300));
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