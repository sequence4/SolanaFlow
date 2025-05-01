"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import dynamic from "next/dynamic"

// Add animated gradient keyframes
const gradientAnimationStyles = `
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
`;

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
  const { toast } = useToast()

  useEffect(() => {
    // Get referral code from URL if present
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) {
      setReferredBy(ref)
    }

    // Set source from document.referrer or UTM
    const utmSource = params.get("utm_source")
    if (utmSource) {
      setSource(utmSource)
    } else if (typeof document !== "undefined" && document.referrer) {
      setSource(document.referrer)
    }
  }, [])

  const validateForm = () => {
    const errors: { [key: string]: string } = {}

    // Require at least one of email or wallet_address
    if (!email && !walletAddress) {
      errors.form = "Please provide either an email or wallet address"
    }

    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Truncate fields to their maximum lengths
  const truncateField = (value: string, maxLength: number) => {
    return value.slice(0, maxLength)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    // Truncate fields to their maximum lengths
    const truncatedWallet = truncateField(walletAddress, 64)
    const truncatedTelegram = truncateField(telegramHandle, 32)
    const truncatedTwitter = truncateField(twitterHandle, 32)
    const truncatedDiscord = truncateField(discordUsername, 37)

    try {
      // Server route note: backend needs to add signup_ip = req.ip and meta = req.headers before INSERT
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          wallet_address: truncatedWallet,
          full_name: fullName,
          telegram_handle: truncatedTelegram,
          twitter_handle: truncatedTwitter,
          discord_username: truncatedDiscord,
          referred_by: referredBy,
          source,
        }),
      })

      if (response.status === 201) {
        toast({
          title: "You're in!",
          description: "We'll keep you updated.",
          className: "bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] text-white border-none",
        })
        // Reset only visible fields, keeping hidden fields intact
        setEmail("")
        setWalletAddress("")
        setFullName("")
        setTelegramHandle("")
        setTwitterHandle("")
        setDiscordUsername("")
      } else {
        const data = await response.json()
        toast({
          title: "Something went wrong",
          description: data.error || "Please try again later.",
          variant: "destructive",
        })
      }
    } catch (error) {
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
    <div className="flex justify-center items-center p-4">
      <div className="relative w-full max-w-xl bg-[#050810] bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-6 border overflow-hidden max-h-[80vh] overflow-y-auto hover:scrollbar-show"
           style={{
             scrollbarWidth: 'thin',
             scrollbarColor: '#1e293b transparent',
             msOverflowStyle: 'none', /* IE and Edge */
             borderImage: 'linear-gradient(to right, rgba(95, 136, 220, 0.7), rgba(28, 246, 160, 0.7), rgba(153, 69, 255, 0.7)) 1',
             borderImageSlice: '1',
             animationName: 'gradientBorderFlow',
             animationDuration: '3s',
             animationIterationCount: 'infinite',
             animationTimingFunction: 'ease',
             borderRadius: '1rem'
           }}>
        <style jsx global>{`
           /* Hide scrollbar by default */
           .max-h-\\[80vh\\] {
             scrollbar-width: thin;
             -ms-overflow-style: none; /* IE and Edge */
           }
           .max-h-\\[80vh\\]::-webkit-scrollbar {
             width: 6px;
             background-color: transparent;
             display: none;
           }
           /* Show scrollbar on hover and when scrolling */
           .max-h-\\[80vh\\]:hover::-webkit-scrollbar,
           .max-h-\\[80vh\\]:focus::-webkit-scrollbar,
           .max-h-\\[80vh\\]:active::-webkit-scrollbar {
             display: block;
           }
           .max-h-\\[80vh\\]::-webkit-scrollbar-thumb {
             background-color: #1e293b;
             border-radius: 6px;
           }
           
           /* Gradient border animation */
           @keyframes gradientBorderFlow {
             0% {
               border-image-source: linear-gradient(to right, rgba(95, 136, 220, 0.7), rgba(28, 246, 160, 0.7), rgba(153, 69, 255, 0.7));
             }
             50% {
               border-image-source: linear-gradient(to right, rgba(153, 69, 255, 0.7), rgba(95, 136, 220, 0.7), rgba(28, 246, 160, 0.7));
             }
             100% {
               border-image-source: linear-gradient(to right, rgba(28, 246, 160, 0.7), rgba(153, 69, 255, 0.7), rgba(95, 136, 220, 0.7));
             }
           }
         `}</style>
        
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 bg-none hover:bg-[#2a3749] text-gray-400 hover:text-white rounded-full p-2 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {/* Grid pattern background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTI5M2IiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-10"></div>

        {/* Hexagon pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fillRule='evenodd'%3E%3Cg id='hexagons' fill='%234d7cfe' fillOpacity='1'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        <div className="pt-4 space-y-6">
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
              Be the first to know when we launch.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
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
              <div className="relative group">
                <Input
                  id="email"
                  type="email"
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
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
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
              <div className="relative group">
                <Input
                  id="wallet"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => {
                    setWalletAddress(e.target.value)
                    if (e.target.value || email) {
                      const newErrors = { ...formErrors }
                      delete newErrors.form
                      setFormErrors(newErrors)
                    }
                  }}
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gray-300 font-mono text-sm flex items-center">
                Full Name{" "}
                <span className="text-gray-500 ml-1">(optional)</span>
              </Label>
              <div className="relative group">
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram" className="text-gray-300 font-mono text-sm flex items-center">
                <span className="text-gray-500 mr-1">#</span> Telegram{" "}
                <span className="text-gray-500 ml-1">(optional)</span>
              </Label>
              <div className="relative group">
                <Input
                  id="telegram"
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitter" className="text-gray-300 font-mono text-sm flex items-center">
                <span className="text-gray-500 mr-1">#</span> Twitter{" "}
                <span className="text-gray-500 ml-1">(optional)</span>
              </Label>
              <div className="relative group">
                <Input
                  id="twitter"
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discord" className="text-gray-300 font-mono text-sm flex items-center">
                <span className="text-gray-500 mr-1">#</span> Discord{" "}
                <span className="text-gray-500 ml-1">(optional)</span>
              </Label>
              <div className="relative group">
                <Input
                  id="discord"
                  type="text"
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                  className="bg-[#0c1221] border-[#1e293b] focus:border-[#38bdf8] text-white placeholder:text-gray-600 h-11 pl-4 font-mono transition-all duration-300 group-hover:border-[#38bdf8]/50"
                />
                <div className="absolute inset-0 border border-[#38bdf8]/0 rounded-md group-hover:border-[#38bdf8]/10 pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] hover:opacity-90 text-white font-medium relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Join the list
                      <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-[#4d7cfe] to-[#22d3ee] group-hover:scale-105 transition-transform duration-300"></span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-[radial-gradient(circle,_white_10%,_transparent_70%)] transition-opacity duration-300"></span>
              </Button>
            </div>

            <div className="flex items-center justify-center space-x-1 text-xs text-center text-gray-500 pt-1">
              <p>We'll only contact you about launch updates</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 