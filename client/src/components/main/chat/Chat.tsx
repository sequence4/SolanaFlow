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
import SequentialCodeDisplay from './SequentialCodeDisplay';
import { ProgressDisplay } from './ProgressDisplay';
import { TaskProgressDisplay } from './TaskProgressDisplay';

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
    
    // Add state for active tasks
    const [activeTasks, setActiveTasks] = useState<Record<string, {
      name: string;
      status: 'running' | 'completed' | 'error';
      pct: number;
      stage: string;
      message?: string;
      thoughts?: string[];
    }>>({});
  
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const messagesAreaRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const scrollStateRef = useRef({
        userHasScrolledUp: false,  // Track if user has manually scrolled up
        lastUserMessageCount: 0,   // Track user messages to trigger scroll resets
    });


    // Simple scroll to bottom function
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
    
    // Keep compatibility with existing calls
    const smartScrollToBottom = scrollToBottom;
    const stableScrollToBottom = scrollToBottom;

    // Simple scroll detection - just track if user has scrolled up
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const element = e.target as HTMLDivElement;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        
        // Check if user is at the bottom (within 100px tolerance)
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
        
        // Update user scroll state
        const hasScrolledUp = !isNearBottom;
        scrollStateRef.current.userHasScrolledUp = hasScrolledUp;
    }, []);

    // Replace MutationObserver with more controlled approach
    useEffect(() => {
        if (messagesAreaRef.current) {
            let observerTimeout: NodeJS.Timeout | null = null;
            let lastHeight = 0;
            
            const observer = new MutationObserver(() => {
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

    // Handle scrolling based on message type
    useEffect(() => {
        if (messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        const currentUserMessageCount = messages.filter(m => m.sender === 'user').length;
        
        // When a new user message is sent, reset scroll behavior and force scroll
        if (lastMessage.sender === 'user') {
            scrollStateRef.current.userHasScrolledUp = false;
            scrollStateRef.current.lastUserMessageCount = currentUserMessageCount;
            
            
            // Force scroll to bottom for user messages
            setTimeout(() => scrollToBottom(true), 100);
        }
        // For AI messages, only scroll if user hasn't scrolled up
        else if (lastMessage.sender === 'ai') {
            // Auto-scroll for AI messages unless user has scrolled up
            setTimeout(() => scrollToBottom(false), 100);
        }
    }, [messages, scrollToBottom]);

    useEffect(() => {
        smartScrollToBottom();
    }, [isTyping, isThinking, smartScrollToBottom]);

    /*
    useEffect(() => {
        console.log(selectedFile);
    }, []);
    */

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

        // Schedule batched processing after 100ms debounce
        logProcessingTimeoutRef.current = setTimeout(() => {
            const fresh = systemLogs.slice(lastLogIndex);

            // Categorize logs instead of filtering them out
            const categorizedLogs = fresh.map(line => {
              try {
                if (line.startsWith('{')) {
                  const parsed = JSON.parse(line);
                  return { ...parsed, raw: line, category: 'structured' };
                }
              } catch (e) {
                // Categorize text logs
                if (line.includes('Docker') || line.includes('container')) {
                  return { raw: line, category: 'docker', type: 'container-log' };
                } else if (line.includes('cargo') || line.includes('Compiling')) {
                  return { raw: line, category: 'build', type: 'build-log' };
                } else if (line.includes('Generating') || line.includes('Creating')) {
                  return { raw: line, category: 'codegen', type: 'codegen-log' };
                }
              }
              return { raw: line, category: 'general', type: 'system-log' };
            });

            // Process structured events for task updates
            categorizedLogs.forEach(log => {
              if (log.type === 'task-start') {
                setActiveTasks(prev => ({
                  ...prev,
                  [log.taskId]: { name: log.taskName, status: 'running', pct: 0, stage: log.stage }
                }));
              } else if (log.type === 'task-update') {
                setActiveTasks(prev => ({
                  ...prev,
                  [log.taskId]: { ...prev[log.taskId], pct: log.pct, message: log.message }
                }));
              } else if (log.type === 'task-complete') {
                setActiveTasks(prev => ({
                  ...prev,
                  [log.taskId]: { ...prev[log.taskId], status: 'completed', pct: 100 }
                }));
                // Remove completed tasks after delay
                setTimeout(() => {
                  setActiveTasks(prev => {
                    const updated = { ...prev };
                    delete updated[log.taskId];
                    return updated;
                  });
                }, 2000);
              } else if (log.type === 'container-setup-progress') {
                // Handle container setup progress with thoughts
                setActiveTasks(prev => ({
                  ...prev,
                  [log.taskId]: { 
                    ...prev[log.taskId], 
                    name: log.taskName,
                    pct: log.pct, 
                    message: log.message,
                    thoughts: log.thoughts,
                    status: 'running',
                    stage: log.stage
                  }
                }));
              }
            });

            // Filter visible logs for display (less aggressive filtering)
            const visible = categorizedLogs.filter(log => 
                !(log.category === 'structured' && ['task-start', 'task-update', 'task-complete'].includes(log.type)) &&
                !log.raw?.includes('Program ID: ') && // Still filter program IDs
                !log.raw?.includes('[...] Program ID:')
            );

            if (visible.length) {
                //console.log('[CHAT] ====== PROCESSING BATCHED SYSTEM LOGS ======');
                //console.log('[CHAT] Processing', visible.length, 'new lines');
                
                const newLogMessages: AIMessageType[] = [];
                let hasCodeGenUpdate = false;
                let latestCodeGenFiles: any[] = [];
                
                for (const log of visible) {
                    const line = log.raw || log;
                    
                    // Create unique key for deduplication
                    const lineKey = `${line.substring(0, 100)}_${Date.now()}`;
                    if (processedEventsRef.current.has(lineKey)) continue;
                    processedEventsRef.current.add(lineKey);
                    
                    // Enhanced thinking triggers based on backend log content
                    if (line.includes("[ENVIRONMENT]") || line.includes("Setting up Docker environment")) {
                        showThinkingForStage('environment');
                    } else if (line.includes("[CODE-GEN]") || line.includes("Starting code generation")) {
                        showThinkingForStage('codegen');
                    } else if (line.includes("Generating Rust program files")) {
                        showThinkingForStage('codegen-files');
                    } else if (line.includes("[BUILD]") || line.includes("Starting build phase")) {
                        showThinkingForStage('build');
                    } else if (line.includes("Anchor build process") || line.includes("cargo build-sbf")) {
                        showThinkingForStage('build-progress');
                    } else if (line.includes("Build completed") || line.includes("Pipeline completed successfully")) {
                        showThinkingForStage('deployment-ready');
                    } else if (line.includes("Container ready") || line.includes("Environment setup complete")) {
                        showThinkingForStage('container-setup');
                    } else if (line.includes("[ARTIFACTS]") || line.includes("Fetching build artifacts")) {
                        showThinkingForStage('build-progress');
                    } else if (line.includes("[FILE-TREE]") || line.includes("file tree")) {
                        showThinkingForStage('file-processing');
                    } else if (line.includes("Program ID determined") || line.includes("Program ID:")) {
                        showThinkingForStage('deployment-ready');
                    }
                    
                    // Handle structured logs directly
                    if (log.category === 'structured') {
                        const parsed = log;
                        
                        // Handle batched code generation events
                        if (parsed.type === 'code-generation-batch' && parsed.files?.length > 0) {
                            // Deduplicate by sequence number
                            if (parsed.sequence && parsed.sequence > lastCodeGenSequenceRef.current) {
                                //console.log('[CHAT] ====== BATCHED CODE GENERATION ======');
                               // console.log('[CHAT] Files:', parsed.files.length);
                                
                                hasCodeGenUpdate = true;
                                latestCodeGenFiles = parsed.files;
                                lastCodeGenSequenceRef.current = parsed.sequence;
                                
                                showThinkingForStage('codegen');
                            }
                            continue;
                        }
                        
                        // Handle individual code generation (legacy support)
                        if (parsed.type === 'code-generation' && parsed.files?.length > 0) {
                           // console.log('[CHAT] ====== INDIVIDUAL CODE GENERATION ======');
                            hasCodeGenUpdate = true;
                            latestCodeGenFiles = [...latestCodeGenFiles, ...parsed.files];
                            showThinkingForStage('codegen');
                            continue;
                        }
                        
                        // Skip progress messages to avoid conflicts
                        if (parsed.type === 'progress' && parsed.pct !== undefined) {
                            continue;
                        }
                    } else {
                        // Handle text-based logs - Filter out progress lines
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
                    //console.log('[CHAT] ====== BATCH UPDATE ======');
                    
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
               // console.log(`[CHAT-DEBUG] Event "${eventName}":`, data);
                if (data.type === 'code-generation') {
                //    console.log('[CHAT-DEBUG] 🎯 CODE-GENERATION EVENT DETECTED!');
                //    console.log('[CHAT-DEBUG] Files count:', data.files?.length || 0);
               //     console.log('[CHAT-DEBUG] Files:', data.files?.map((f: any) => f.filename));
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
    //  Enhanced completion detection and friendly AI response
    // ———————————————————————————————
    useEffect(() => {
        const onComplete = () => {
            // Clear any active tasks
            setActiveTasks({});
            setIsThinking(false);
            setCurrentThinkingStage(null);
            
            setMessages(prev => [
                ...prev,
                {
                    text: "Your Solana program has been built successfully! The deployment pipeline is complete and your program is ready for deployment to devnet or mainnet. What would you like to do next?",
                    sender: "ai",
                    timestamp: new Date(),
                    status: "sent"
                }
            ]);
            // Reset scroll state for new message
            
            taskLogs.setSuppressToast(false);      // re-enable normal task-log toasts
        };
        
        // Listen for pipeline completion via progress events
        const onProgressUpdate = (data: any) => {
            if (data.type === 'pipeline-complete' || 
                (data.stage === 'build' && data.status === 'completed' && data.message?.includes('finished'))) {
                setTimeout(onComplete, 1000); // Small delay to let final progress updates show
            }
        };
        
        eventBus.on("build-complete", onComplete);
        eventBus.on("progress", onProgressUpdate);
        
        return () => {
            eventBus.off("build-complete", onComplete);
            eventBus.off("progress", onProgressUpdate);
        };
    }, [taskLogs]);


    const { publicKey, connected } = useWallet();

    useEffect(() => {
        //console.log('Wallet connection status:', connected);
       // console.log('Wallet public key:', publicKey?.toBase58() || 'Not connected');
    }, [connected, publicKey]);



    const sendMessage = async () => {
        const trimmed = input.trim().toLowerCase();
        if (trimmed === 'build') {
          taskLogs.setSuppressToast(true);

          // Add user message
          setMessages(prev => [
            ...prev,
            { text: input, sender: 'user', timestamp: new Date(), status: 'sent' }
          ]);
          setInput('');
          
          // Immediately show build starting message with spinner
          setMessages(prev => [
            ...prev,
            { 
              text: "Starting build process...", 
              sender: 'ai', 
              isChecklist: true, 
              timestamp: new Date(), 
              status: 'sent' 
            }
          ]);

          // Forward build command
          eventBus.emit('chat-build-command');
          
          return;
        }
        
        if (input.trim()) {
            const selectedFiles = [selectedFile, ...additionalFiles].filter(
                (file): file is FileTreeItemType => Boolean(file)
            );

           // console.log("Files selected for context:", selectedFiles);
            
            setMessages([...messages, { 
                text: input, 
                sender: 'user',
                files: selectedFiles,
                timestamp: new Date(),
                status: 'sending'
            }]);
            setInput('');
             // Reset scroll state for new message

            setIsTyping(true);

            try {
                const fileTasks = await Promise.all(
                    selectedFiles.map(async (file) => {
                        if (file.path && projectContext.id) {
                        //    console.log("Fetching content for file:", file.path);
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
                           // console.log("Fetched content for file:", fileTask.filePath, "Length:", content.length);
                            return {
                                path: fileTask.filePath,
                                content: content || 'No content available',
                            };
                        }
                        return { path: 'Unknown path', content: 'No content available' };
                    })
                );

                const userPublicKeyString = connected && publicKey ? publicKey.toBase58() : '';
               // console.log('Using wallet public key for AI request:', userPublicKeyString || 'No wallet connected');

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
               // console.error('Failed to send message to AI:', error);
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
          "Analyzing your workflow graph structure",
          "Planning optimal Solana program architecture",
          "Validating instruction dependencies and relationships",
          "Designing account structures for minimal rent costs",
          "Calculating compute unit requirements",
          "Preparing secure Docker development environment",
          "Estimated completion: 3-4 minutes"
        ],
        'environment': [
          "Initializing secure Docker container with Solana toolchain",
          "Installing Rust stable toolchain with BPF target support",
          "Setting up Anchor framework v0.30 for program development",
          "Configuring Solana CLI tools for local development",
          "Preparing build cache and dependency management",
          "Mounting project workspace with proper permissions",
          "Environment ready - all development tools configured"
        ],
        'codegen': [
          "Analyzing workflow requirements for optimal instruction design",
          "Generating secure Rust program with proper validation logic",
          "Creating custom instruction handlers with error checking",
          "Building comprehensive TypeScript SDK for frontend integration",
          "Designing account structures optimized for your use case",
          "Implementing wallet adapter hooks for seamless user experience",
          "Generating production-ready React components and utilities",
          "Creating Interface Definition Language for program interaction"
        ],
        'codegen-files': [
          "Writing main program library with your custom instructions",
          "Implementing instruction validation and security checks",
          "Creating account data structures with proper serialization",
          "Generating comprehensive TypeScript bindings and types",
          "Building React hooks for program state management",
          "Setting up wallet connection and transaction handling",
          "Creating test infrastructure and example usage patterns"
        ],
        'build': [
          "Initiating Anchor build pipeline for Solana deployment",
          "Compiling Rust source code to Berkeley Packet Filter bytecode",
          "Running comprehensive program validation and security checks",
          "Optimizing bytecode size and execution efficiency",
          "Generating deterministic program keypair for deployment",
          "Creating deployment artifacts and metadata files",
          "Validating program fits within Solana account size limits",
          "Build pipeline complete - program ready for deployment"
        ],
        'build-progress': [
          "Processing Rust compilation - analyzing dependencies",
          "Compiling core program logic and instruction handlers",
          "Linking Solana runtime dependencies and libraries",
          "Optimizing bytecode for minimal compute unit usage",
          "Running static analysis and security validation",
          "Generating Interface Definition Language metadata",
          "Creating deployment package with all required artifacts",
          "Final verification complete - build successful"
        ],
        'deployment-ready': [
          "Deployment pipeline completed successfully",
          "All program artifacts generated and validated",
          "TypeScript SDK ready for frontend integration",
          "Program ID assigned and configured in environment",
          "Your Solana program is now ready for deployment to devnet/mainnet"
        ],
        'container-setup': [
          "Allocating dedicated compute resources for your build",
          "Pulling latest Solana development container images",
          "Configuring secure container networking and isolation",
          "Setting up persistent storage for efficient build caching",
          "Initializing development toolchain and dependencies"
        ],
        'file-processing': [
          "Analyzing project structure and source file organization",
          "Processing and validating all program dependencies",
          "Optimizing file layout for efficient compilation pipeline",
          "Preparing source code repository for container build process"
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
            /Generating.*files?/i,
            /Creating.*files?/i,
            /Code generation/i,
            /Generated.*files?/i,
            /Here.*(?:is|are).*(?:files?|code)/i,
            /```(?:rust|toml|typescript|javascript)/i, // Any code blocks with these languages
            /\.rs|\.toml|\.ts|\.js/i // Any mention of these file extensions
        ];

        const isCodeGenMessage = codeGenPatterns.some(pattern => pattern.test(messageText));
       // console.log('[parseCodeGenFiles] Is code generation message:', isCodeGenMessage);
      //  console.log('[parseCodeGenFiles] Matched patterns:', codeGenPatterns.filter(pattern => pattern.test(messageText)));
        
        if (!isCodeGenMessage) return null;

        // Extract code blocks with filenames - more flexible pattern
        const codeBlockRegex = /```(\w+)?\s*(?:(?:\/\/|#|<!--)\s*(.+\.\w+))?.*?\n([\s\S]*?)```/g;
        const files = [];
        let match;

    //    console.log('[parseCodeGenFiles] Searching for code blocks in message');
     //   console.log('[parseCodeGenFiles] Message preview:', messageText.substring(0, 200));

        while ((match = codeBlockRegex.exec(messageText)) !== null) {
            const [fullMatch, language = 'rust', filename, content] = match;
            console.log('[parseCodeGenFiles] Found code block:', {
                language,
                filename,
                contentLength: content?.length || 0,
                fullMatchPreview: fullMatch.substring(0, 100)
            });
            
            if (content && content.trim()) {
                // Generate filename if not provided
                const finalFilename: string = filename || `generated_${files.length + 1}.${language === 'rust' ? 'rs' : language === 'typescript' ? 'ts' : 'txt'}`;
                
                files.push({
                    filename: finalFilename,
                    content: content.trim(),
                    language: language || 'rust'
                });
                
          //      console.log('[parseCodeGenFiles] Added file:', finalFilename);
            }
        }
        
     //   console.log('[parseCodeGenFiles] Total files found:', files.length);

        return files.length > 0 ? files : null; // Use SequentialCodeDisplay for any files found
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
                                                <div className="leading-relaxed w-full min-w-0 flex-1">
                                                    {/* Render message content */}
                                                    
                                                    {(() => {
                                                        /*
                                                        console.log(`[RENDER] Message ${index} render check:`, {
                                                            isChecklist: message.isChecklist,
                                                            hasCodeGenFiles: !!message.codeGenFiles,
                                                            fileCount: message.codeGenFiles?.length || 0,
                                                            sender: message.sender,
                                                            textPreview: message.text?.substring(0, 30) || 'empty'
                                                        });
                                                        */
                                                        // Check if we should show task progress at the top level
                                                        if (Object.keys(activeTasks).length > 0 && index === messages.length - 1) {
                                                           // console.log('[RENDER] ================ RENDERING TaskProgressDisplay ================');
                                                            return <TaskProgressDisplay tasks={activeTasks} />;
                                                        } else if (message.codeGenFiles && message.codeGenFiles.length > 0) {
                                                            // Show progress indicator instead of code files
                                                            return (
                                                                <div className="flex items-center gap-2 text-sm text-gray-400 p-2 bg-gray-800/30 rounded">
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    <span>Generated {message.codeGenFiles.length} program files successfully</span>
                                                                </div>
                                                            );
                                                        } else if (message.isChecklist) {
                                                            //console.log('[RENDER] Rendering ProgressDisplay');
                                                            return <ProgressDisplay />;
                                                        } else {
                                                            //console.log('[RENDER] Rendering MarkdownRenderer for text message');
                                                            return (
                                                                <div className="w-full max-w-full overflow-hidden">
                                                                    <MarkdownRenderer 
                                                                        content={message.text}
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

                    {/* Task Progress Display - shown separately from messages */}
                    {Object.keys(activeTasks).length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full py-4"
                        >
                            <TaskProgressDisplay tasks={activeTasks} />
                        </motion.div>
                    )}

                    {/* Typing/Thinking indicator */}
                    {(isTyping || isThinking) && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full py-4"
                        >
                            <div className="flex items-start gap-3">
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
                                                    <Loader2 
                                                        size={12} 
                                                        className={step.completed ? "" : "animate-spin"}
                                                    />
                                                    <span className="text-sm">
                                                        {step.text.replace(/[^\x00-\x7F]/g, '').trim()}
                                                    </span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <Loader2 size={16} className="animate-spin text-cyan-500" />
                                            <span className="text-sm text-gray-500 italic">Processing...</span>
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