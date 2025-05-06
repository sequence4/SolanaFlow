"use client"

import React, { useState, useEffect } from "react"

interface BackgroundEffectProps {
  mounted: boolean
}

interface Particle {
  id: number;
  top: string;
  left: string;
  animation: string;
  animationDelay: string;
  color: string;
  textShadow: string;
  fontSize: string;
  char: string;
}

export default function BackgroundEffect({ mounted }: BackgroundEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  
  useEffect(() => {
    if (mounted) {
      const gradientColors = ['#5f88dc', '#1cf6a0', '#9945ff'];
      const newParticles = Array.from({ length: 100 }).map((_, i) => {
        const randomColor = gradientColors[Math.floor(Math.random() * gradientColors.length)];
        
        return {
          id: i,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animation: `fall ${5 + Math.random() * 15}s linear infinite`,
          animationDelay: `${Math.random() * 5}s`,
          color: randomColor,
          textShadow: `0 0 5px ${randomColor}`,
          fontSize: '1rem',
          char: String.fromCharCode(33 + Math.floor(Math.random() * 94))
        };
      });
      
      setParticles(newParticles);
    }
  }, [mounted]);
  
  if (!mounted || particles.length === 0) return null;
  
  return (
    <div className="fixed inset-0 z-0 opacity-15 overflow-hidden pointer-events-none">
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              top: particle.top,
              left: particle.left,
              animation: particle.animation,
              animationDelay: particle.animationDelay,
              color: particle.color,
              textShadow: particle.textShadow,
              fontSize: particle.fontSize,
            }}
          >
            {particle.char}
          </div>
        ))}
      </div>
    </div>
  )
} 