"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2, X, Terminal } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import confetti from "canvas-confetti"
import type { Options } from "canvas-confetti"
import {
  isEmail,
  isSolPubkey,
  isHandle,
  isDiscordHandle
} from "@/utils/validators";

export const POPUP_ACCENT = "#38E8FF"
export const POPUP_ACCENT_RGB = "56 232 255"

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
        referred_by: referredBy,
        source,
      };

      if (walletAddress.trim()) body.wallet_address = truncatedWallet;
      if (telegramHandle.trim()) body.telegram_handle = truncatedTelegram;
      if (twitterHandle.trim()) body.twitter_handle = truncatedTwitter;
      if (discordUsername.trim()) body.discord_username = truncatedDiscord;

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
    <div className="bg-gradient-to-b from-[#0D1117] to-[#0A0E14] text-white border border-[rgb(var(--popup-accent)/0.10)] 
    rounded-lg shadow-[0_0_10px_rgba(56,232,255,0.3)]"
         style={{ "--popup-accent": POPUP_ACCENT_RGB } as React.CSSProperties }>
      <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--popup-accent)/0.20)] bg-gradient-to-r from-[#0D1117] via-[#101620] to-[#0D1117]">
        <div className="flex items-center">
          <Terminal className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-sm text-gray-400"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}>
            Join the SolanaFlow Waitlist
          </span>
        </div>
       
      </div>

      <ScrollArea className="h-[400px] p-6 flex flex-col justify-center items-center" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-[15%]">
            <h3 className="text-lg sm:text-2xl text-gray-200 mb-2 ">You&apos;re on the waitlist!</h3>
            <p className="text-gray-400 text-sm sm:text-base mb-4">
              We&apos;ll notify you as soon as SolanaFlow is ready for you.
            </p>
            <Button
              onClick={onClose}
              variant="outline"
              className="bg-transparent border-[#1d4d57] text-[#255b66] hover:bg-[rgba(56,232,255,0.10)] 
                hover:text-[#3a8d9e] font-mono text-xs font-semibold rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(56,232,255,0.15)]"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.email ? "border-red-500" : ""
                  }`}
                  placeholder="you@example.com"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
                />
                {formErrors.email && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="wallet" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Wallet (Solana)
                </Label>
                <Input
                  id="wallet"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value.trimStart())}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.wallet ? "border-red-500" : ""
                  }`}
                  placeholder="Your Solana wallet address"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
                />
                {formErrors.wallet && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.wallet}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fullName" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Name{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.fullName ? "border-red-500" : ""
                  }`}
                  placeholder="Your full name"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
                />
                {formErrors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="telegram" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Telegram{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="telegram"
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value.trimStart())}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.telegram ? "border-red-500" : ""
                  }`}
                  placeholder="@username"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
                />
                {formErrors.telegram && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.telegram}</p>
                )}
              </div>

              <div>
                <Label htmlFor="twitter" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Twitter{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="twitter"
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value.trimStart())}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.twitter ? "border-red-500" : ""
                  }`}
                  placeholder="@handle"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
                />
                {formErrors.twitter && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.twitter}</p>
                )}
              </div>

              <div>
                <Label htmlFor="discord" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  Discord{" "}
                  <span className="text-gray-500 ml-1">(optional)</span>
                </Label>
                <Input
                  id="discord"
                  type="text"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value.trimStart())}
                  className={`bg-[#0D1117] border-[rgb(var(--popup-accent)/0.10)] text-[#E6E6E6] placeholder:text-[#5b6775] text-xs sm:text-sm h-8 sm:h-10 ${
                    formErrors.discord ? "border-red-500" : ""
                  }`}
                  placeholder="username#0000"
                  style={{ fontFamily: 'var(--font-chakra-petch)' }}
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
                  className="mt-1 h-4 w-4 rounded text-[#38E8FF] border-[rgb(var(--popup-accent)/0.30)] focus:ring-0 bg-[#0D1117]"
                />
                <Label htmlFor="consent" className="text-xs sm:text-sm text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
                  I agree to receive email updates about SolanaFlow&apos;s launch and related product news.
                </Label>
              </div>
              {formErrors.consent && (
                <p className="text-red-500 text-xs mt-1">{formErrors.consent}</p>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-[rgb(var(--popup-accent)/0.20)] bg-gradient-to-r from-transparent via-[rgba(56,232,255,0.05)] to-transparent">
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="join-waitlist-btn"
                variant="outline"
                className="bg-transparent border-[#1d4d57] text-[#255b66] hover:bg-[rgba(56,232,255,0.10)] 
                hover:text-[#3a8d9e] font-mono text-xs font-semibold rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(56,232,255,0.15)]"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
              >
                <span className="flex items-center justify-center">
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
              </Button>
            </div>
          </form>
        )}
      </ScrollArea>
    </div>
  )
} 