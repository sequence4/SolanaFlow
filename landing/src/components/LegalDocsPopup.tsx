"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronUp, Terminal } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"

export const POPUP_ACCENT = "#38E8FF"  
export const POPUP_ACCENT_RGB = "56 232 255" 

interface LegalDocsPopupProps {
  trigger?: React.ReactNode
  isOpen?: boolean
  onClose?: () => void
}

export default function LegalDocsPopup({ trigger, isOpen: externalIsOpen, onClose }: LegalDocsPopupProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  
  const isControlled = externalIsOpen !== undefined && onClose !== undefined
  const isOpen = isControlled ? externalIsOpen : internalIsOpen
  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      if (!open) onClose?.()
    } else {
      setInternalIsOpen(open)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger 
        asChild
        style={{ "--popup-accent": POPUP_ACCENT_RGB } as React.CSSProperties}
      >
        {trigger ?? (
          <Button
            variant="outline"
            className="bg-transparent border border-[rgb(var(--popup-accent)/0.20)] text-[#38E8FF] hover:bg-[rgba(56,232,255,0.10)] hover:text-[#38E8FF]"
            style={{ fontFamily: 'var(--font-chakra-petch)' }}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Legal Docs & Contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        style={{ "--popup-accent": POPUP_ACCENT_RGB } as React.CSSProperties }
        className="sm:max-w-[700px] max-w-[95vw] p-0 bg-gradient-to-b from-[#0D1117] to-[#0A0E14] 
                  border border-[rgb(var(--popup-accent)/0.20)] 
                  rounded-lg 
                  shadow-[0_0_20px_rgba(56,232,255,0.2)]"
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[rgb(var(--popup-accent)/0.20)] 
                        bg-gradient-to-r from-[#0D1117] via-[#101620] to-[#0D1117]">
          <div className="flex items-center relative">
            <Terminal className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-gray-400" />
            <span className="text-xs sm:text-sm relative z-10 text-gray-400" 
            style={{ fontFamily: 'var(--font-chakra-petch)' }}
            >
              SolanaFlow Legal Docs
            </span>
          </div>
          <DialogPrimitive.Close asChild>
          </DialogPrimitive.Close>
        </div>

        <Tabs defaultValue="terms" className="w-full">
          <div className="border-b border-[rgb(var(--popup-accent)/0.20)] bg-gradient-to-r from-transparent 
                          via-[rgba(56,232,255,0.05)] to-transparent">
            <TabsList className="bg-transparent h-10 sm:h-12 p-0 pl-2 sm:pl-4 flex gap-1 sm:gap-2 overflow-x-auto"
            style={{ fontFamily: 'var(--font-chakra-petch)' }}>
              <TabsTrigger
                value="terms"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(56,232,255,0.10)] 
                          data-[state=active]:to-[rgba(94,162,239,0.10)] data-[state=active]:text-transparent 
                          data-[state=active]:bg-clip-text data-[state=active]:bg-gradient-to-r 
                          data-[state=active]:from-[#38E8FF] data-[state=active]:to-[#5EA2EF] 
                          rounded px-2 sm:px-3 py-1 sm:py-2 font-mono text-xs sm:text-sm"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
              >
                Terms and Conditions
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(56,232,255,0.10)] 
                data-[state=active]:to-[rgba(94,162,239,0.10)] data-[state=active]:text-transparent 
                data-[state=active]:bg-clip-text data-[state=active]:bg-gradient-to-r 
                data-[state=active]:from-[#38E8FF] data-[state=active]:to-[#5EA2EF] 
                rounded px-2 sm:px-3 py-1 sm:py-2 font-mono text-xs sm:text-sm"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
              >
                Privacy Policy
              </TabsTrigger>
              <TabsTrigger
                value="cookies"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(56,232,255,0.10)] 
                data-[state=active]:to-[rgba(94,162,239,0.10)] data-[state=active]:text-transparent 
                data-[state=active]:bg-clip-text data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#38E8FF] 
                data-[state=active]:to-[#5EA2EF] rounded px-2 sm:px-3 py-1 sm:py-2 font-mono text-xs sm:text-sm"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
              >
                Cookie Policy
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[rgba(56,232,255,0.10)] 
                data-[state=active]:to-[rgba(94,162,239,0.10)] data-[state=active]:text-transparent data-[state=active]:bg-clip-text 
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#38E8FF] data-[state=active]:to-[#5EA2EF] 
                rounded px-2 sm:px-3 py-1 sm:py-2 font-mono text-xs sm:text-sm"
                style={{ fontFamily: 'var(--font-chakra-petch)' }}
              >
                Contact
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[300px] sm:h-[400px] p-4 sm:p-6 text-gray-400" style={{ fontFamily: 'var(--font-chakra-petch)' }}>
            <TabsContent value="terms" className="text-gray-400 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <TerminalContent content={termsContent} />
            </TabsContent>
            <TabsContent value="privacy" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <TerminalContent content={privacyContent} />
            </TabsContent>
            <TabsContent value="cookies" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <TerminalContent content={cookiesContent} />
            </TabsContent>
            <TabsContent value="contact" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <TerminalContent content={contactContent} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end p-3 sm:p-4 border-t border-[rgb(var(--popup-accent)/0.20)] bg-gradient-to-r from-transparent 
                           via-[rgba(56,232,255,0.05)] to-transparent">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="bg-transparent
                        border-[rgb(var(--popup-accent)/0.10)]
                        text-[#153c47]
                        hover:text-[#1f505e]
                        font-mono text-xs sm:text-sm font-semibold
                        rounded-md px-3 sm:px-4 py-1 sm:py-2
                        shadow-[0_0_10px_rgba(56,232,255,0.15)]"
                        style={{ fontFamily: 'var(--font-chakra-petch)' }}
            >
              Accept&nbsp;Terms
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  )
}

function TerminalContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const sections = content.split("## ").filter(Boolean)

  return (
    <div className="font-mono text-xs sm:text-sm text-gray-400 leading-relaxed space-y-4 sm:space-y-6 bg-gradient-to-b from-transparent to-[#0A0E14]/50" 
    style={{ fontFamily: 'var(--font-chakra-petch)' }}>
      {sections.map((section, index) => {
        const [title, ...contentLines] = section.split("\n")
        const sectionContent = contentLines.join("\n")
        const sectionId = `section-${index}`

        return (
          <div key={sectionId} className="border border-[rgb(var(--popup-accent)/0.20)] rounded-md overflow-hidden backdrop-blur-sm">
            <div
              className="flex items-center justify-between p-2 sm:p-3 bg-gradient-to-r from-[rgba(56,232,255,0.05)] to-[rgba(94,162,239,0.05)] cursor-pointer"
              onClick={() => setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))}
            >
              <div className="text-transparent bg-clip-text bg-gradient-to-r from-[#38E8FF] to-[#5EA2EF] font-semibold ml-1 sm:ml-2 text-xs sm:text-sm">
                {title.trim()}
              </div>
              {expanded[sectionId] ? (
                <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-transparent bg-clip-text bg-gradient-to-r from-[#38E8FF] to-[#5EA2EF]" />
              ) : (
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-transparent bg-clip-text bg-gradient-to-r from-[#38E8FF] to-[#5EA2EF]" />
              )}
            </div>

            {expanded[sectionId] && (
              <div className="p-3 sm:p-4 bg-gradient-to-b from-[#0D1117] to-[#0A0E14] whitespace-pre-wrap border-t border-[rgb(var(--popup-accent)/0.10)] text-xs sm:text-sm">
                {sectionContent}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const termsContent = `## General Terms
These Terms of Service ("Terms") govern your access to and use of SolanaFlow ("Service").
By accessing or using the Service, you agree to be bound by these Terms.

## User Accounts
You are responsible for safeguarding your account.
You may not share your account credentials with others.

## Acceptable Use
You may not use the Service for any illegal purposes.
You may not interfere with the operation of the Service.

## Intellectual Property
All content on the Service is the property of SolanaFlow.
You may not use our trademarks without permission.

## Termination
We may terminate your access to the Service at any time.
You may terminate your account at any time.

## Limitation of Liability
We are not liable for any damages arising from your use of the Service.
We do not guarantee the accuracy of content on the Service.

## Changes to Terms
We may modify these Terms at any time.
Continued use of the Service constitutes acceptance of modified Terms.`;

const privacyContent = `## Information Collection
We collect information you provide directly to us.
We collect information about your use of the Service.

## Use of Information
We use your information to provide and improve the Service.
We use your information to communicate with you.

## Information Sharing
We do not sell your personal information.
We may share your information with service providers.

## Data Security
We implement measures to protect your information.
No method of transmission is 100% secure.

## Your Rights
You may access, update, or delete your information.
You may opt out of marketing communications.

## International Transfers
Your information may be transferred to other countries.
These countries may have different data protection laws.

## Children's Privacy
The Service is not intended for children under 13.
We do not knowingly collect information from children.

## Changes to Privacy Policy
We may modify this Privacy Policy at any time.
Continued use of the Service constitutes acceptance of modified Policy.`;

const cookiesContent = `## What Are Cookies
Cookies are small text files stored on your device.
They help us recognize your device and remember certain information.

## Types of Cookies We Use
Essential cookies: necessary for the Service to function.
Analytics cookies: help us understand how you use the Service.
Marketing cookies: used to deliver advertisements relevant to you.

## Managing Cookies
You can set your browser to refuse all or some cookies.
Blocking cookies may impact your experience of the Service.

## Third-Party Cookies
Some cookies are placed by third parties on our behalf.
We do not control these third-party cookies.

## Changes to Cookie Policy
We may modify this Cookie Policy at any time.
Continued use of the Service constitutes acceptance of modified Policy.`;

const contactContent = `## Get in Touch
For questions about SolanaFlow or these documents, reach out:

* Email: team@solanaflow.io
* X (Twitter): @solanaflow_io
* Telegram: https://t.me/+WVRI_EcdZrkyZDhk

## Copyright & Trademark
© ${new Date().getFullYear()} Sequence4 Ltd.
All product names, logos, and brands are property of their respective owners.`;
