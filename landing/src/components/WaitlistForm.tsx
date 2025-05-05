"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2, X } from "lucide-react"
import confetti from "canvas-confetti"
import type { Options } from "canvas-confetti"
import {
  isEmail,
  isSolPubkey,
  isHandle,
  isDiscordHandle
} from "@/utils/validators";

interface WaitlistFormProps {
  onClose?: () => void;
}

export default function WaitlistForm({ onClose }: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [fullName, setFullName] = useState("")
  const [telegramHandle, setTelegramHandle] = useState("")
  const [twitterHandle, setTwitterHandle] = useState("")
  const [discordUsername, setDiscordUsername] = useState("")
  const [referredBy, setReferredBy] = useState("")
  const [source, setSource] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})
  const [isSuccess, setIsSuccess] = useState(false)
  const [csrf, setCsrf] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const { toast } = useToast()
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    
    let scrollTimeout: NodeJS.Timeout;
    const scrollDiv = contentRef.current;
    
    const handleScroll = () => {
      scrollDiv.classList.add('scrolling');
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scrollDiv.classList.remove('scrolling');
      }, 1000);
    };
    
    scrollDiv.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollDiv.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) {
      setReferredBy(ref)
    }

    const utmSource = params.get("utm_source")
    if (utmSource) {
      setSource(utmSource)
    } else if (typeof document !== "undefined" && document.referrer) {
      setSource(document.referrer)
    }
  }, [])

  useEffect(() => {
    fetch("/api/csrf-token")
      .then(r => r.json())
      .then(d => setCsrf(d.token))
      .catch(() => console.error("could not get CSRF token"));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const validateForm = () => {
    const errors: Record<string,string> = {};

    if (!email) errors.email = "Email is required";
    if (!consent) errors.consent = "Please tick the consent box";

    if (email && !isEmail(email)) errors.email = "Invalid email";
    if (walletAddress && !isSolPubkey(walletAddress)) errors.wallet = "Invalid wallet";
    if (telegramHandle && !isHandle(telegramHandle)) errors.telegram = "Invalid Telegram handle";
    if (twitterHandle && !isHandle(twitterHandle)) errors.twitter = "Invalid Twitter handle";
    if (discordUsername && !isDiscordHandle(discordUsername)) errors.discord = "Invalid Discord handle";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const truncateField = (value: string, maxLength: number) => {
    return value.slice(0, maxLength)
  }

  const safeConfetti = (opts: Options = {}): void => {
    try {
      const config = { ...opts } as Options & { useWorker: boolean };
      config.useWorker = false;
      confetti(config);
    } catch (err: unknown) {
      /* eslint-disable-next-line no-console */
      console.warn('Confetti disabled:', err);
    }
  };

  const triggerConfetti = () => {
    const colors = ["#5f88dc", "#1cf6a0", "#9945ff"];
    const duration = 3_000;
    const animationEnd = Date.now() + duration;
  
    safeConfetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0 },
      colors,
      shapes: ["square", "circle"],
      scalar: 1.2,
      disableForReducedMotion: true,
    });
  
    setTimeout(() => {
      safeConfetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors,
        shapes: ["square"],
        scalar: 1,
        disableForReducedMotion: true,
      });
  
      safeConfetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors,
        shapes: ["circle"],
        scalar: 1,
        disableForReducedMotion: true,
      });
    }, 250);
  
    setTimeout(() => {
      const intervalId = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(intervalId);
          return;
        }
  
        const particleCount = Math.floor((timeLeft / duration) * 30);
  
        safeConfetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: {
            x: Math.random(),
            y: Math.random() - 0.2,
          },
          colors,
          shapes: ["square"],
          scalar: 0.8,
          gravity: 1.2,
          drift: 0,
          disableForReducedMotion: true,
        });
      }, 250);
    }, 500);
  };
  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const honeypot = (e.target as HTMLFormElement).website?.value;
    if (honeypot) return;
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    const truncatedWallet = truncateField(walletAddress, 64)
    const truncatedTelegram = truncateField(telegramHandle, 32)
    const truncatedTwitter = truncateField(twitterHandle, 32)
    const truncatedDiscord = truncateField(discordUsername, 37)

    try {
      const body: Record<string, unknown> = {
        email,
        consent,
        full_name: fullName,
        telegram_handle: truncatedTelegram,
        twitter_handle: truncatedTwitter,
        discord_username: truncatedDiscord,
        referred_by: referredBy,
        source,
      };

      if (walletAddress.trim()) {
        body.wallet_address = truncatedWallet;
      }

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast({
          title: "You're in!",
          description: "We&apos;ll keep you updated.",
          className: "bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] text-white border-none",
        })
        
        setIsSuccess(true)
        
        triggerConfetti()
        
        setEmail("")
        setWalletAddress("")
        setFullName("")
        setTelegramHandle("")
        setTwitterHandle("")
        setDiscordUsername("")
      } else {
        let apiError = 'Unknown error';
        const cType = response.headers.get('content-type') ?? '';
        if (cType.includes('application/json')) {
          try {
            ({ error: apiError } = await response.json());
          } catch { /* ignore */ }
        } else {
          try {
            apiError = await response.text();
          } catch { /* ignore */ }
        }
        toast({
          title: "Something went wrong",
          description: apiError || "Please try again later.",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Connection error",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="gradient-border overflow-hidden w-full relative"
         style={{
           borderRadius: '0rem'
         }}>
      <style jsx global>{`
         .gradient-border {
           position: relative;
           z-index: 0;
           border-radius: 1rem;
           padding: 1px;
         }
         
         .gradient-border::before {
           content: '';
           position: absolute;
           z-index: -1;
           inset: 0;
           border-radius: inherit;
           padding: 1px;
           background: linear-gradient(to right, #5f88dc, #1cf6a0, #9945ff);
           background-size: 300% 300%;
           animation: gradientFlow 3s ease infinite;
           -webkit-mask: 
              linear-gradient(#fff 0 0) content-box, 
              linear-gradient(#fff 0 0);
           -webkit-mask-composite: xor;
           mask-composite: exclude;
         }

         @keyframes gradientFlow {
           0% {
             background-position: 0% 50%;
           }
           50% {
             background-position: 100% 50%;
           }
           100% {
             background-position: 0% 50%;
           }
         }

         .content-scroll {
           scrollbar-width: thin;
           scrollbar-color: #1e293b transparent; 
           -ms-overflow-style: none;
           position: relative;
         }
         
         .content-scroll::-webkit-scrollbar {
           width: 6px;
           height: 6px;
         }
         
         .content-scroll::-webkit-scrollbar-track {
           background: transparent;
         }
         
         .content-scroll::-webkit-scrollbar-thumb {
           background: #1e293b;
           border-radius: 2px;
           border: 2px solid transparent;
           background-clip: padding-box;
           transition: background 0.2s ease;
         }
         
         .content-scroll:hover::-webkit-scrollbar-thumb,
         .content-scroll.scrolling::-webkit-scrollbar-thumb {
           background: #334155;
         }

         .custom-input {
           border-radius: 0.5rem !important;
           padding: 0.7rem !important;
           height: auto !important;
           background-color: rgba(12, 18, 33, 0.6) !important;
           border: 1px solid #1e293b !important;
           transition: all 0.3s ease !important;
           color: white !important;
           font-family: monospace !important;
         }
         
         .custom-input:focus {
           border-color: #38bdf8 !important;
           box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.1) !important;
         }
         
         .custom-input:hover {
           border-color: rgba(56, 189, 248, 0.4) !important;
         }

         .custom-input::placeholder {
           color: rgba(156, 163, 175, 0.5) !important;
         }
       `}</style>
      
      <div className="w-full bg-[#050810] bg-opacity-95 backdrop-blur-lg">
        <div className="content-scroll max-h-[80vh] overflow-y-auto p-8 space-y-6" ref={contentRef}>
          
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-50 bg-none hover:bg-[#2a3749] text-gray-400 hover:text-white rounded-full p-2 transition-colors"
            >
              <X size={16} />
            </button>
          )}

          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-10 rounded-[1.4rem]"></div>

          <div
            className="absolute inset-0 opacity-[0.03] rounded-[1.4rem]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fillRule='evenodd'%3E%3Cg id='hexagons' fill='%234d7cfe' fillOpacity='1'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>

          {isSuccess ? (
            <div className="pt-8 flex flex-col items-center justify-center h-[400px] relative z-10">
              <img src="/assets/logo.png" alt="Logo" className="h-16 w-16 opacity-70 mb-4" />
              <h2 className="text-3xl font-bold mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                  style={{
                    backgroundSize: "300% 300%",
                    animation: "gradientFlow 3s ease infinite"
                  }}>
                  Stay Tuned!
                </span>
              </h2>
              <p className="text-gray-600 text-center mb-8 max-w-sm font-mono" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                Thanks for joining the SolanaFlow waitlist. We&apos;ll keep you updated on our launch and progress.
              </p>
              <button
                onClick={() => {
                  if (onClose) {
                    console.log("Close button clicked, calling onClose handler");
                    onClose();
                  } else {
                    console.log("No onClose handler provided to WaitlistForm");
                  }
                }}
                className="relative py-2 px-6 rounded bg-[#1e2033] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
                style={{ zIndex: 100 }}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="relative z-10 space-y-6">
              <div className="space-y-2 text-center">
                <div className="flex justify-center items-center mb-2">
                  
                </div>
                <h2 className="text-3xl font-bold">
                  <span className="text-white">Join the </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                    style={{
                      backgroundSize: "300% 300%",
                      animation: "gradientFlow 3s ease infinite"
                    }}>
                    Waitlist
                  </span>
                </h2>
                <p className="text-gray-400 text-sm">
                  Be the first to know when&nbsp;we&nbsp;launch.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 pt-2 w-full">
                <input type="hidden" name="referred_by" value={referredBy} />
                <input type="hidden" name="source" value={source} />

                {formErrors.form && (
                  <div
                    className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-2 rounded-md text-sm font-mono"
                    role="alert"
                    aria-live="assertive"
                  >
                    {formErrors.form}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300 font-mono text-sm flex items-center">
                    Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      maxLength={254}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (formErrors.email) {
                          const newErrors = { ...formErrors }
                          delete newErrors.email
                          if (e.target.value || walletAddress) {
                            delete newErrors.form
                          }
                          setFormErrors(newErrors)
                        }
                      }}
                      aria-invalid={!!formErrors.email}
                      className="custom-input w-full"
                      placeholder="youremail@example.com"
                    />
                  </div>
                  {formErrors.email && (
                    <p className="text-red-500 text-xs font-mono" aria-live="polite">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wallet" className="text-gray-300 font-mono text-sm flex items-center">
                    Wallet (Solana)
                  </Label>
                  <div className="relative">
                    <Input
                      id="wallet"
                      type="text"
                      maxLength={44}
                      value={walletAddress}
                      onChange={(e) => {
                        setWalletAddress(e.target.value)
                        if (e.target.value || email) {
                          const newErrors = { ...formErrors }
                          delete newErrors.form
                          setFormErrors(newErrors)
                        }
                      }}
                      className="custom-input w-full"
                      placeholder="Your Solana wallet address"
                    />
                  </div>
                  {formErrors.wallet && (
                    <p className="text-red-500 text-xs font-mono" aria-live="polite">
                      {formErrors.wallet}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-gray-300 font-mono text-sm flex items-center">
                    Full Name{" "}
                    <span className="text-gray-500 ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="fullName"
                      type="text"
                      maxLength={80}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="custom-input w-full"
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram" className="text-gray-300 font-mono text-sm flex items-center">
                    <span className="text-gray-500 mr-1">#</span> Telegram{" "}
                    <span className="text-gray-500 ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="telegram"
                      type="text"
                      maxLength={32}
                      value={telegramHandle}
                      onChange={(e) => setTelegramHandle(e.target.value)}
                      className="custom-input w-full"
                      placeholder="@username"
                    />
                  </div>
                  {formErrors.telegram && (
                    <p className="text-red-500 text-xs font-mono" aria-live="polite">
                      {formErrors.telegram}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter" className="text-gray-300 font-mono text-sm flex items-center">
                    <span className="text-gray-500 mr-1">#</span> Twitter{" "}
                    <span className="text-gray-500 ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="twitter"
                      type="text"
                      maxLength={32}
                      value={twitterHandle}
                      onChange={(e) => setTwitterHandle(e.target.value)}
                      className="custom-input w-full"
                      placeholder="@handle"
                    />
                  </div>
                  {formErrors.twitter && (
                    <p className="text-red-500 text-xs font-mono" aria-live="polite">
                      {formErrors.twitter}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discord" className="text-gray-300 font-mono text-sm flex items-center">
                    <span className="text-gray-500 mr-1">#</span> Discord{" "}
                    <span className="text-gray-500 ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="discord"
                      type="text"
                      maxLength={37}
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      className="custom-input w-full"
                      placeholder="username#0000"
                    />
                  </div>
                  {formErrors.discord && (
                    <p className="text-red-500 text-xs font-mono" aria-live="polite">
                      {formErrors.discord}
                    </p>
                  )}
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded text-[#4d7cfe] border-gray-600 focus:ring-0"
                  />
                  <Label htmlFor="consent" className="text-gray-300 text-xs">
                    I agree to receive email updates about SolanaFlow&rsquo;s launch and related product news.
                  </Label>
                </div>
                {formErrors.consent && (
                  <p className="text-red-500 text-xs font-mono" aria-live="polite">
                    {formErrors.consent}
                  </p>
                )}

                {/* Honeypot – will be hidden with CSS */}
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="website">Leave blank</Label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    className="opacity-0 w-0 h-0"
                    onChange={() => { /* no-op */ }}
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="join-waitlist-btn"
                    className="w-full py-3 bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] hover:opacity-90 text-white font-medium relative overflow-hidden group rounded-xl"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Join the waitlist
                          <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] group-hover:scale-105 transition-transform duration-300"></span>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-[radial-gradient(circle,_white_10%,_transparent_70%)] transition-opacity duration-300"></span>
                  </Button>
                </div>

                <div className="flex items-center justify-center space-x-1 text-xs text-center text-gray-500 pt-1">
                  <p>We&apos;ll only contact you about launch updates</p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 