import React from 'react'

export default function LandingStyles() {
  return (
    <style jsx global>{`
      /* Google Fonts - DM Sans */
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
      
      .dm-sans {
        font-family: "DM Sans", sans-serif;
        font-optical-sizing: auto;
        font-weight: inherit;
        font-style: normal;
      }
      
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
  )
} 