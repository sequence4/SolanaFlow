import { useEffect, useRef, useState } from "react"
import { codeFiles } from "./data/mock-code-files"

export default function TypewriterCode() {
    const [displayText, setDisplayText] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)
    const [loopNum, setLoopNum] = useState(0)
    const [typingSpeed, setTypingSpeed] = useState(30)
    const [aiProgress, setAiProgress] = useState(0)
    const [aiStatus, setAiStatus] = useState("Analyzing token structure...")
    const [showCursor, setShowCursor] = useState(true)
    const [activeTokens, setActiveTokens] = useState([false, false, false, false, false, false])
    const [currentFileIndex, setCurrentFileIndex] = useState(0)
    
    const terminalRef = useRef<HTMLDivElement>(null)
    
    const maxVisibleLines = 18   
    const currentCode = codeFiles[currentFileIndex]
  
    const fileNames = [
      "init_mint_context.rs",
      "initialize_mint.rs",
      "mint_to_context.rs",
      "mint_to.rs",
      "transfer_context.rs",
      "transfer_tokens.rs"
    ]
  
    const shouldStartDeleting = (text: string) => {
      const lines = text.split('\n');
      return lines.length >= maxVisibleLines;
    }
  
    useEffect(() => {
      const progress = Math.min(100, Math.round((displayText.length / currentCode.length) * 100))
      setAiProgress(progress)
  
      const statusInterval = setInterval(() => {
        if (displayText.length > 0) {
          const statuses = [
            "Analyzing token structure...",
            "Optimizing gas efficiency...",
            "Validating security patterns...",
            "Checking Anchor compliance...",
            "Scanning for vulnerabilities...",
            "Verifying program logic...",
          ]
          setAiStatus(statuses[Math.floor(Math.random() * statuses.length)])
        }
      }, 3000)
  
      const tokenInterval = setInterval(() => {
        setActiveTokens(activeTokens.map(() => Math.random() > 0.7))
      }, 800)
  
      return () => {
        clearInterval(statusInterval)
        clearInterval(tokenInterval)
      }
    }, [displayText, currentCode.length, activeTokens, currentCode])
  
    useEffect(() => {
      let timeout: NodeJS.Timeout
      const cursorInterval = setInterval(() => {
        setShowCursor((prev) => !prev)
      }, 530)
  
      if (!isDeleting && shouldStartDeleting(displayText)) {
        timeout = setTimeout(() => {
          setIsDeleting(true)
          setTypingSpeed(5) 
        }, 1000)
      }
      else if (!isDeleting && displayText === currentCode) {
        timeout = setTimeout(() => {
          setIsDeleting(true)
          setTypingSpeed(5) 
        }, 2000)
      }
      else if (isDeleting && displayText === "") {
        setIsDeleting(false)
        setLoopNum(loopNum + 1)
        setTypingSpeed(5) 
        setCurrentFileIndex((currentFileIndex + 1) % codeFiles.length)
      }
      else if (!isDeleting) {
        const nextChar = currentCode.substring(0, displayText.length + 1)
        timeout = setTimeout(() => {
          setDisplayText(nextChar)
        }, typingSpeed)
      }
      else {
        const nextChar = currentCode.substring(0, displayText.length - 1)
        timeout = setTimeout(() => {
          setDisplayText(nextChar)
        }, typingSpeed)
      }
  
      return () => {
        clearTimeout(timeout)
        clearInterval(cursorInterval)
      }
    }, [displayText, isDeleting, loopNum, typingSpeed, currentCode, currentFileIndex, codeFiles.length])
  
    const renderCodeWithHighlighting = () => {
      const lines = displayText.split('\n');
      
      return lines.map((line, lineIndex) => {
        if (!line.trim()) return <div key={`line-${lineIndex}`}>&nbsp;</div>;
        
        let highlightedLine = line;
        
        highlightedLine = highlightedLine
          .replace(/\b(use|pub|mod|fn|super|let|const|if|else|for|while|return|struct|enum|trait|impl|type|where|async|await|mut|static|ref|self|Self|match|in|as|unsafe|extern|crate)\b/g, 
                   '<span style="color: #81a1c1;">$1</span>');
        
        highlightedLine = highlightedLine
          .replace(/\b(Context|Result|Option|String|Vec|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|f32|f64|bool|char|str|Box|Arc|Rc|Mutex|RwLock|RefCell|Cell)\b/g, 
                   '<span style="color: #b48ead;">$1</span>');
        
        highlightedLine = highlightedLine
          .replace(/\b(InitializeMint|MintToParams|InitializeMintParams|MintTo|Transfer|TransferContext|MintToContext|InitializeMintContext|TokenAccount|instructions)\b/g, 
                   '<span style="color: #a3be8c;">$1</span>');
        
        highlightedLine = highlightedLine
          .replace(/\b(initialize_mint|mint_to|transfer|transfer_tokens|burn|freeze_account|thaw_account|close_account|set_authority)\b/g, 
                   '<span style="color: #ebcb8b;">$1</span>');
        
        highlightedLine = highlightedLine
          .replace(/(\#\[[a-zA-Z_]+\])/g, '<span style="color: #81a1c1;">$1</span>');
        
        highlightedLine = highlightedLine
          .replace(/(::|->)/g, '<span style="color: #eceff4;">$1</span>');
        
        return (
          <div 
            key={`line-${lineIndex}`} 
            dangerouslySetInnerHTML={{ __html: highlightedLine }}
          />
        );
      });
    };
  
    return (
      <div className="flex flex-col h-full">
        {/* Main content area with code and analysis side by side */}
        <div className="flex flex-1">
          {/* Code area - takes most of the space */}
          <div className="flex-1 p-2 overflow-hidden relative">
            <div 
              ref={terminalRef}
              className="relative font-mono text-gray-300 text-xs" 
              style={{ 
                height: '100%', 
                maxHeight: '100%', 
                overflow: 'hidden' 
              }}
            >
              <div className="whitespace-pre overflow-hidden">
                {renderCodeWithHighlighting()}
                <span 
                  className="text-[#1cf6a0] animate-pulse inline-block"
                  style={{ 
                    position: 'relative',
                    marginLeft: '1px',
                    display: showCursor ? 'inline-block' : 'none'
                  }}
                >▋</span>
              </div>
            </div>
          </div>
  
          {/* AI Analysis sidebar - minimal and futuristic */}
          <div className="w-[60px] border-l border-[#1e2033] flex flex-col items-center py-2 opacity-80">
            {/* Vertical progress bar */}
            <div className="w-1 h-full bg-[#1e2033] rounded-full overflow-hidden relative mx-auto my-2">
              <div
                className="absolute bottom-0 w-full bg-gradient-to-t from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                style={{
                  height: `${aiProgress}%`,
                  transition: "height 0.2s ease-out",
                }}
              ></div>
            </div>
  
            {/* Analysis indicators - minimal dots */}
            <div className="space-y-4 mt-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${activeTokens[i] ? "bg-[#1cf6a0]" : "bg-[#1e2033]"}`}
                  style={{
                    transition: "background-color 0.3s ease",
                    boxShadow: activeTokens[i] ? "0 0 6px rgba(28, 246, 160, 0.6)" : "none",
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
  
        {/* Bottom status bar - always visible */}
        <div className="h-6 border-t border-[#1e2033] flex items-center justify-between px-3 text-xs text-[#1cf6a0] bg-[#0a0b14]/80">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-[#1cf6a0]"
                  style={{
                    animation: `aiPulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }}
                ></div>
              ))}
            </div>
            <span className="text-[10px] font-mono">{aiStatus}</span>
          </div>
  
          {/* File name display */}
          <div className="text-[10px] font-mono opacity-70">
            {fileNames[currentFileIndex]}
          </div>
  
          {/* Neural network visualization - minimal version */}
          <div className="flex space-x-1">
            {[...Array(8)].map((_, i) => {
              const isActive = Math.random() > 0.7
              return (
                <div
                  key={i}
                  className={`w-2 h-px ${isActive ? "bg-[#1cf6a0]" : "bg-[#1e2033]"}`}
                  style={{
                    opacity: isActive ? 0.8 : 0.3,
                    animation: isActive ? `aiFlicker 1.5s ease-in-out ${Math.random() * 2}s infinite` : "",
                  }}
                ></div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }