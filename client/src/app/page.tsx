"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code, Cpu, Layers } from "lucide-react"
import { BsTelegram } from "react-icons/bs";
import { BsTwitterX } from "react-icons/bs";
import { BsYoutube } from "react-icons/bs";
import { useEffect, useState, useRef } from "react"
import InstructionFlow from "@/components/landing/InstructionFlow"

const TypewriterCode = () => {
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

  const codeFiles = [
    // Initialize Mint
    `use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token, InitializeMint, Token};

#[derive(Accounts)]
pub struct InitializeMintContext<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub token_mint: AccountInfo<'info>,
    
    #[account(address = spl_token::id())]
    pub token_program: Program<'info, Token>,
    
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeMintParams {
    pub decimals: u8,
    pub mint_authority: Pubkey,
}`,

    // Initialize Mint Implementation
    `pub fn initialize_mint(
      ctx: Context<InitializeMintContext>,
      params: InitializeMintParams,
    ) -> Result<()> {
      let payer = &ctx.accounts.payer;
      let token_mint_info = &ctx.accounts.token_mint;
      let token_program = &ctx.accounts.token_program;
      let rent = &ctx.accounts.rent;

      let mint_len = spl_token::state::Mint::LEN;
      let lamports = rent.minimum_balance(mint_len);
      
      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          InitializeMint {
              mint: token_mint_info.clone(),
              rent: rent.to_account_info(),
          },
      );

      token::initialize_mint(cpi_ctx, params.decimals, 
                            &params.mint_authority, None)?;

      emit!(MintInitialized {
          mint_authority: params.mint_authority,
          amount: 0,
      });

      Ok(())
    }`,

    // MintTo Context
    `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, MintTo};

#[derive(Accounts)]
pub struct MintToContext<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    
    #[account(mut)]
    pub token_mint: AccountInfo<'info>,
    
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintToParams {
    pub amount: u64,
}`,

    // MintTo Implementation
    `pub fn mint_to(
      ctx: Context<MintToContext>,
      params: MintToParams,
    ) -> Result<()> {
      let token_program = &ctx.accounts.token_program;
      let token_mint = &ctx.accounts.token_mint;
      let destination = &ctx.accounts.destination;
      let authority = &ctx.accounts.mint_authority;

      if token_mint.owner != &spl_token::id() {
          return err!(MintToError::MintNotOwnedByTokenProgram);
      }

      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          MintTo {
              mint: token_mint.clone(),
              to: destination.clone(),
              authority: authority.to_account_info(),
          },
      );

      token::mint_to(cpi_ctx, params.amount)?;

      emit!(TokensMinted {
          mint_authority: authority.key(),
          amount: params.amount,
      });

      Ok(())
    }`,

    // Transfer Context
    `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

#[derive(Accounts)]
pub struct TransferContext<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub source: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransferParams {
    pub amount: u64,
}`,

    // Transfer Implementation
    `pub fn transfer_tokens(
      ctx: Context<TransferContext>,
      params: TransferParams,
    ) -> Result<()> {
      let authority = &ctx.accounts.authority;
      let source = &ctx.accounts.source;
      let destination = &ctx.accounts.destination;
      let token_program = &ctx.accounts.token_program;

      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          Transfer {
              from: source.to_account_info(),
              to: destination.to_account_info(),
              authority: authority.to_account_info(),
          },
      );

      token::transfer(cpi_ctx, params.amount)?;

      emit!(TransferCompleted {
          source: source.key(),
          destination: destination.key(),
          amount: params.amount,
      });

      Ok(())
    }`
  ]

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

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    return () => {
      setMounted(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-mono overflow-x-hidden">
      {/* Matrix-like background effect */}
      <div className="fixed inset-0 z-0 opacity-15 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          {Array.from({ length: 100 }).map((_, i) => {
            // Define gradient colors
            const gradientColors = ['#5f88dc', '#1cf6a0', '#9945ff'];
            const randomColor = gradientColors[Math.floor(Math.random() * gradientColors.length)];
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `fall ${5 + Math.random() * 15}s linear infinite`,
                  animationDelay: `${Math.random() * 5}s`,
                  color: randomColor,
                  textShadow: `0 0 5px ${randomColor}`,
                  fontSize: '0.875rem',
                }}
              >
                {String.fromCharCode(33 + Math.floor(Math.random() * 94))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 border-b border-[#1e2033] bg-[#0a0b14]/50 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 relative">
              <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
              <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
            </div>
            <span className="text-xl font-bold tracking-tighter">
              <span className="text-white">Solana</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                style={{
                  backgroundSize: "300% 300%",
                  animation: "gradientFlow 3s ease infinite"
                }}>FlowCode</span>
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-12">
            <Link href="#features" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
            Features
          </Link>
            <Link href="#demo" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
              Demo
          </Link>
            <Link href="#team" className="text-gray-400 hover:text-[#5580ff] transition-colors text-sm">
              Team
          </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex justify-center relative w-screen h-[100vh] py-4 sm:py-4 md:py-8 lg:py-10 overflow-hidden">
        <div className="w-full h-full container relative z-10 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col w-full h-full md:flex-row items-start py-16 sm:py-20 md:py-25">
            {/* Left side content */}
            <div className="flex flex-col justify-evenly gap-2 h-full w-full md:w-2/5 lg:w-2/5 mb-12 md:mb-0 pr-0 md:pr-4 lg:pr-8">
              <div className="flex flex-col gap-0 justify-start">
                <div className="w-fit inline-block px-2 sm:px-3 py-1 mb-4 sm:mb-6 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
                  <span className="mr-2">●</span> Visual AI Developer Tool for Solana
                </div>
                <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight">
                  <span className="block">Build Solana dApps</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                    }}>
                    Without Code
                </span>
                </h1>
              </div>
              <p className="text-gray-400 mb-6 sm:mb-8 max-w-lg text-xs sm:text-sm leading-relaxed">
                <ul className="list-disc list-inside">
                  <li><span className="text-white font-semibold">FlowCode</span> transforms English into Solana programs.</li>
                  <li>Design, build, and deploy decentralized applications with our visual workflow builder and
                  specialized Solana IDE.</li>
                </ul>
              </p>
              <div className="flex flex-col sm:flex-row justify-start gap-2">
                <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white p-2 rounded whitespace-nowrap">
                  <span className="cursor-pointer text-xs sm:text-sm">Join the Waitlist</span>
                </Button>
                <div className="flex items-center justify-center gap-2 hover:bg-none mt-2 sm:mt-0">
                    <Button size="icon" variant="ghost"><BsTelegram className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                    <Button size="icon" variant="ghost"><BsTwitterX className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                    <Button size="icon" variant="ghost"><BsYoutube className="h-4 w-4 sm:h-5 sm:w-5 text-[#5580ff] cursor-pointer hover:bg-none" /></Button>
                </div>
          </div>
        </div>

            {/* Right side - Flow diagram and code snippet */}
            <div className="w-full h-full md:w-3/5 flex flex-col lg:flex-row mt-8 md:mt-0">
              {/* Flow Diagram */}
              <div className="w-full lg:w-3/5 relative">
                <div className="h-[600px]">
                  {mounted && <InstructionFlow />}
            </div>
          </div>

              {/* Code Terminal */}
              <div className="w-full lg:w-2/5 flex items-center justify-center relative">
                <div className="mt-8 lg:mt-0 rounded-lg overflow-hidden border border-[#2a2d4a] bg-[#0d0e1a] w-full h-[90%] absolute top-[5%] left-0 right-0">
                  <div className="flex items-center px-4 py-2 bg-[#1e2033] border-b border-[#2a2d4a]">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#ff5f57]"></div>
                      <div className="w-2 h-2 rounded-full bg-[#febc2e]"></div>
                      <div className="w-2 h-2 rounded-full bg-[#28c840]"></div>
                    </div>
                    <div className="ml-4 text-sm text-gray-400">token_minting_program.rs</div>
                  </div>
                  <div className="h-full">
                    <TypewriterCode />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 bg-[#0d0e1a]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
              <span className="mr-2">⚡</span> Powerful Development Tools
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5580ff] to-[#a855f7]">
                Build. Deploy. Scale.
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Our platform combines cutting-edge technologies to provide a secure, intelligent, and decentralized
              development experience for Solana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Feature 1 - Workflow */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#5580ff]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#5580ff]/10 flex items-center justify-center mb-4 group-hover:bg-[#5580ff]/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-[#5580ff]"
                >
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Visual Workflow Builder</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#5580ff] text-xs">workflow</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Drag and drop Solana plugins to visually design your dApp architecture without writing a single line of
                code.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Pre-built Solana components
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Smart contract templates
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#5580ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Visual flow connections
                </li>
              </ul>
            </div>

            {/* Feature 2 - Code */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#a855f7]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#a855f7]/10 flex items-center justify-center mb-4 group-hover:bg-[#a855f7]/20 transition-colors">
                <Code className="w-6 h-6 text-[#a855f7]" />
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Solana-Specific IDE</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#a855f7] text-xs">code</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                A powerful code editor tailored specifically for Solana development with intelligent autocompletion and
                debugging.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Rust and TypeScript support
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Real-time error checking
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#a855f7] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Integrated testing tools
                </li>
              </ul>
            </div>

            {/* Feature 3 - Interface */}
            <div className="bg-[#0a0b14] border border-[#2a2d4a] rounded-xl p-6 hover:border-[#00c2ff]/50 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-lg bg-[#00c2ff]/10 flex items-center justify-center mb-4 group-hover:bg-[#00c2ff]/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-[#00c2ff]"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <line x1="3" x2="21" y1="9" y2="9" />
                  <line x1="9" x2="9" y1="21" y2="9" />
                </svg>
              </div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold">Interactive UI Builder</h3>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1e2033] text-[#00c2ff] text-xs">interface</span>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Preview and interact with your generated dApp UI in real-time as you build your Solana application.
              </p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Live UI previews
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Wallet integration testing
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-[#00c2ff] mr-2 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Responsive design tools
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section id="demo" className="py-20 bg-[#0a0b14]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-[#1e2033] border border-[#2a2d4a] text-xs text-[#5580ff]">
              <span className="mr-2">▶</span> Demo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5580ff] to-[#a855f7]">
                See FlowCode in Action
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm">
              Watch how easy it is to build and deploy a Solana dApp in minutes with our visual development platform.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2a2d4a] shadow-2xl">
              {/* Video placeholder - replace with actual video embed */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d0e1a] to-[#0a0b14] flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#5580ff]/20 backdrop-blur-md flex items-center justify-center mb-4 cursor-pointer hover:bg-[#5580ff]/30 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-8 h-8 text-white"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-gray-300 text-sm">Click to watch demo</p>

                {/* Terminal-like code snippets */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#00d16b] border border-[#2a2d4a]">
                    {"$ solana program deploy ./target/deploy/token_program.so"}
                  </div>
                  <div className="absolute top-2/3 right-1/4 transform translate-x-1/2 -translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#a855f7] border border-[#2a2d4a]">
                    {"pub fn mint_to(ctx: Context<MintTo>, amount: u64) -> Result<()> {"}
                  </div>
                  <div className="absolute bottom-1/4 left-1/3 transform -translate-x-1/2 translate-y-1/2 bg-[#0a0b14] rounded p-2 text-xs font-mono text-[#5580ff] border border-[#2a2d4a]">
                    {"Program deployed to: 4LQr...FvkQ"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#5580ff]/20 flex items-center justify-center mr-3">
                    <span className="text-[#5580ff] font-bold">1</span>
                  </div>
                  <h3 className="font-semibold text-sm">Design Your Workflow</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Drag and drop components to create your dApp architecture visually.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#a855f7]/20 flex items-center justify-center mr-3">
                    <span className="text-[#a855f7] font-bold">2</span>
                  </div>
                  <h3 className="font-semibold text-sm">Customize Your Code</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Fine-tune your smart contracts and frontend code in our specialized IDE.
                </p>
              </div>

              <div className="bg-[#0d0e1a] border border-[#2a2d4a] rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#00c2ff]/20 flex items-center justify-center mr-3">
                    <span className="text-[#00c2ff] font-bold">3</span>
                  </div>
                  <h3 className="font-semibold text-sm">Deploy & Monitor</h3>
                </div>
                <p className="text-gray-400 text-xs">
                  Launch your dApp to testnet or mainnet with one click and track performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-[#0d0e1a] border border-[#2a2d4a] rounded-2xl p-8 md:p-12 relative overflow-hidden">
            {/* Background effect */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#5580ff] rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#a855f7] rounded-full blur-3xl opacity-10 translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="relative z-10 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">Ready to Build Effortlessly on Solana?</h2>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-sm">
                Join hundreds of other people on our waitlist to be informed when we launch.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" className="bg-[#5580ff] hover:bg-[#4466cc] text-white px-8 rounded" asChild>
                  <Link href="/main" className="flex items-center justify-center">
                    Join The Waitlist <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Terminal-like element */}
              <div className="mt-8 max-w-md mx-auto rounded-lg overflow-hidden border border-[#2a2d4a] text-left">
                <div className="bg-[#1e2033] px-4 py-2 flex items-center">
                  <div className="flex space-x-2 mr-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                  </div>
                  <span className="text-xs text-gray-400">terminal</span>
                </div>
                <div className="bg-[#0a0b14] p-4 font-mono text-xs">
                  <p className="text-gray-400">$ solana-cli</p>
                  <p className="text-[#00d16b]">Connecting to Solana...</p>
                  <p className="text-white">✓ Connected to Solana mainnet</p>
                  <p className="text-gray-400">$ solana deploy my-token-app</p>
                  <p className="text-[#5580ff]">
                    Deploying to Solana... <span className="animate-pulse">▋</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0b14] border-t border-[#1e2033] py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-6 md:mb-0">
              <div className="w-8 h-8 relative">
                <img src="/assets/logo.png" alt="FlowCode Logo" className="w-full h-full" />
                <div className="absolute inset-0 bg-[#5580ff]/20 blur-xl rounded-full"></div>
              </div>
              <span className="text-lg font-bold tracking-tighter">
                <span className="text-white">Solana</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]" 
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>FlowCode</span>
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mb-6 md:mb-0">
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Terms of Service
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                About
              </Link>
            </div>
            <div className="flex space-x-4">
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsTelegram className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsTwitterX className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1e2033]">
                <BsYoutube className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#1e2033] text-center text-gray-500 text-xs">
            © {new Date().getFullYear()} Solana FlowCode. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes floatNodes {
          0% { transform: translateX(0px) translateY(0px); }
          25% { transform: translateX(5px) translateY(4px); }
          50% { transform: translateX(-5px) translateY(2px); }
          75% { transform: translateX(2px) translateY(-2px); }
          100% { transform: translateX(0px) translateY(0px); }
        }
        
        @keyframes floatNodes2 {
          0% { transform: translateX(0px) translateY(0px); }
          33% { transform: translateX(-4px) translateY(3px); }
          66% { transform: translateX(4px) translateY(-3px); }
          100% { transform: translateX(0px) translateY(0px); }
        }
        
        @keyframes floatNodes3 {
          0% { transform: translateX(0px) translateY(0px); }
          25% { transform: translateX(3px) translateY(-4px); }
          50% { transform: translateX(-5px) translateY(2px); }
          75% { transform: translateX(4px) translateY(3px); }
          100% { transform: translateX(0px) translateY(0px); }
        }
        
        @keyframes fall {
          0% { transform: translateY(-100%); opacity: 1; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
        
        @keyframes border-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes aiPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        @keyframes aiFlicker {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
