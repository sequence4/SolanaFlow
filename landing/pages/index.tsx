import React from 'react'
import Head from 'next/head'
import InstructionFlow  from '@/components/landing/InstructionFlow'
import TypewriterCode   from '@/components/landing/TypeWriterCode'
import ScrollReveal     from '@/components/landing/ScrollReveal'
import InstructionNode  from '@/components/landing/InstructionNode'
import LandingStyles    from '@/components/landing/style'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-mono overflow-x-hidden">
      <Head>
        <title>SolanaFlow AI – Coming Soon</title>
        <link rel="icon" href="/assets/logo.png" />
      </Head>

      <section className="py-20">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-8">FlowCode Demo</h1>
          <div className="mb-12"><InstructionFlow /></div>
          <div className="mb-12"><TypewriterCode /></div>
          <div className="mb-12">
            <ScrollReveal>
              <InstructionNode
                id="demo"
                name="Demo Instruction"
                description="This is a demo"
                status="Active"
                accounts={[]}
                inputs={[]}
                codePreview={"// code preview"}
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <LandingStyles />
    </div>
  )
}
