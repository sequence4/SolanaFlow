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

export interface AIMessageType {
  text: string;
  sender: 'ai' | 'user';
  files?: FileTreeItemType[];
  timestamp?: Date;
  status?: 'sending' | 'sent' | 'error';
  isLogLine?: boolean;
  isChecklist?: boolean;
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
    const taskLogs = useTaskLogs();  // Complete taskLogs object including systemLogs and setSuppressToast
    const { systemLogs } = taskLogs;
    const [lastLogIndex, setLastLogIndex] = useState(0);  // 🟡 NEW
  
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

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
          "Generating Anchor code",
          "Code generation complete",
          "Building program",
          "Linking target/deploy",
          "Collecting project files"
        ];

        const visible = fresh.filter(
          line => !IGNORE_PREFIXES.some(p => line.startsWith(p))
        );

        if (visible.length) {
            const logMessages: AIMessageType[] = visible.map(line => ({
                text: line,
                sender: 'ai',           // show as if the assistant "thinks out loud"
                timestamp: new Date(),
                status: 'sent',
                isLogLine: true,
            }));

            setMessages(prev => [...prev, ...logMessages]);
            setLastLogIndex(systemLogs.length);
            // Ensure scroll sticks to bottom
            scrollToBottom();
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

          // 2) forward build command globally
          eventBus.emit('chat-build-command');

          // 3) insert checklist bubble before returning
          setMessages(prev => [
            ...prev,
            { text: input, sender: 'user', timestamp: new Date(), status: 'sent' },
            { text: "", sender: 'ai', isChecklist: true, timestamp: new Date(), status: 'sent' }
          ]);
          setInput('');
          return;                             // stop normal AI flow
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

    return (
        <div
            className={`flex flex-col h-full ${isExpanded ? "fixed inset-4 z-50" : ""} transition-all duration-300 ease-in-out`}
        >
            <div 
                className="chat-container flex flex-col h-full bg-card border-border overflow-hidden"
                style={{ maxWidth: '900px', width: '65vw' }}
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
                    className="messages-area text-sm flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
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
                                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-lg ${
                                            isUser
                                                ? "user-message bg-primary text-primary-foreground"
                                                : isLog
                                                  ? "log-message bg-transparent text-muted-foreground"
                                                  : "ai-message bg-muted text-foreground"
                                        }`}
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word', 
                                            overflowWrap: 'break-word',
                                            overflowX: 'hidden'
                                        }}
                                    >
                                        <div className="p-3">
                                            <div className="flex items-start gap-2">
                                                {!isUser && (
                                                    <div className="bot-icon-container mt-1 bg-muted-foreground/10 p-1 rounded-full">
                                                        <Bot size={14} className="bot-icon text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className="leading-relaxed">
                                                    {message.isChecklist
                                                        ? <ChatChecklistBubble />
                                                        : <MarkdownRenderer 
                                                            content={message.text} 
                                                            enableCodeTypewriter={!isUser && !isLog && message.text.includes('```')}
                                                          />}
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

                    {/* Typing indicator */}
                    {isTyping && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="typing-indicator bg-muted text-foreground rounded-lg p-3 max-w-[85%]"
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word', 
                                    overflowWrap: 'break-word',
                                    overflowX: 'hidden'
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="bot-icon-container bg-muted-foreground/10 p-1 rounded-full">
                                        <Bot size={14} className="bot-icon text-muted-foreground" />
                                    </div>
                                    <div className="flex space-x-1">
                                        <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse"></div>
                                        <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse delay-150"></div>
                                        <div className="typing-dot ai-thinking-dot w-2 h-2 rounded-full bg-muted-foreground animate-pulse delay-300"></div>
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