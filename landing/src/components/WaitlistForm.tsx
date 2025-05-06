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

  const truncateField = (value: string, maxLength: number) => {
    return value.slice(0, maxLength)
  }

  const apiErrorToFormError: Record<string, string> = {
    duplicate: 'This email is already on the waitlist.',
    'rate-limit exceeded': 'Too many requests – please try again in a minute.',
    'db insert failed': 'Sorry, something went wrong on our side. Try later.',
  };

  const safeConfetti = (opts: Options = {}): void => {
    try {
      const config = { ...opts } as Options & { useWorker: boolean };
      config.useWorker = false;
      confetti(config);
    } catch (err: unknown) {
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
    
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      document.getElementById(firstKey)?.focus();
    }
    
    return Object.keys(errors).length === 0;
  }

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
          title: "You&apos;re in!",
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
        let apiError = 'unknown';
        const ct = response.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          try {
            ({ error: apiError } = await response.json());
          } catch { /* ignore */ }
        } else {
          try {
            apiError = (await response.text()).trim();
          } catch { /* ignore */ }
        }

        const friendly = apiErrorToFormError[apiError] ?? 'Please try again later.';

        if (response.status === 409 && apiError === 'duplicate') {
          setFormErrors((prev) => ({ ...prev, email: friendly }));
        } else {
          toast({
            title: 'Something went wrong',
            description: friendly,
            variant: 'destructive',
          });
        }
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
    <div className="bg-[#0d0e1a] text-white rounded-2xl border border-[#2a2d4a] shadow-xl">
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#2a2d4a]">
        <div className="flex items-center space-x-2">
          <span className="text-base sm:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff]"
                style={{
                  backgroundSize: "300% 300%",
                  animation: "gradientFlow 3s ease infinite"
                }}>
            Join the SolanaFlow Waitlist
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      <div 
        ref={contentRef}
        className="overflow-y-auto max-h-[60vh] sm:max-h-[70vh] px-4 sm:px-6 py-4 sm:py-6 custom-scrollbar"
      >
        {isSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#5f88dc] via-[#1cf6a0] to-[#9945ff] flex items-center justify-center">
              <ArrowRight className="h-8 w-8 sm:h-10 sm:w-10 text-[#0d0e1a]" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">You&apos;re on the waitlist!</h3>
            <p className="text-gray-400 text-sm sm:text-base mb-4">
              We&apos;ll notify you as soon as SolanaFlow is ready for you.
            </p>
            <Button
              onClick={onClose}
              className="bg-[#1e2033] hover:bg-[#2a2d4a] text-white"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs sm:text-sm text-gray-400">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.email ? "border-red-500" : ""
                  }`}
                  placeholder="you@example.com"
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="wallet" className="text-xs sm:text-sm text-gray-400">
                  Wallet (Solana)
                </Label>
                <Input
                  id="wallet"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.wallet ? "border-red-500" : ""
                  }`}
                  placeholder="Your Solana wallet address"
                />
                {formErrors.wallet && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.wallet}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fullName" className="text-xs sm:text-sm text-gray-400">
                  Name{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.fullName ? "border-red-500" : ""
                  }`}
                  placeholder="Your full name"
                />
                {formErrors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="telegram" className="text-xs sm:text-sm text-gray-400">
                  Telegram{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="telegram"
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.telegram ? "border-red-500" : ""
                  }`}
                  placeholder="@username"
                />
                {formErrors.telegram && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.telegram}</p>
                )}
              </div>

              <div>
                <Label htmlFor="twitter" className="text-xs sm:text-sm text-gray-400">
                  Twitter{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="twitter"
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.twitter ? "border-red-500" : ""
                  }`}
                  placeholder="@handle"
                />
                {formErrors.twitter && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.twitter}</p>
                )}
              </div>

              <div>
                <Label htmlFor="discord" className="text-xs sm:text-sm text-gray-400">
                  Discord{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="discord"
                  type="text"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                  className={`bg-[#1e2033] border-[#2a2d4a] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.discord ? "border-red-500" : ""
                  }`}
                  placeholder="username#0000"
                />
                {formErrors.discord && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.discord}</p>
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
                <Label htmlFor="consent" className="text-xs sm:text-sm text-gray-400">
                  I agree to receive email updates about SolanaFlow&apos;s launch and related product news.
                </Label>
              </div>
              {formErrors.consent && (
                <p className="text-red-500 text-xs mt-1">{formErrors.consent}</p>
              )}
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="join-waitlist-btn"
                className="w-full py-2 bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] hover:opacity-90 text-white font-medium relative overflow-hidden group rounded-xl"
              >
                <span className="relative z-10 flex items-center justify-center text-[14px]">
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

            <div className="flex items-center justify-center space-x-1 text-[10px] text-center text-gray-500 pt-1">
              <p>We&apos;ll only contact you about launch updates</p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 