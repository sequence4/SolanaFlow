import React from 'react'

export default function LandingStyles() {
  return (
    <>
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
      
      <style jsx global>{`
        .instruction-wrapper {
          width: 300px;
          height: 370px;
          position: relative;
        }

        .instruction-border {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .instruction-border::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: 8px;
          background: linear-gradient(90deg, #5f88dc, #1cf6a0, #9945ff, #5f88dc);
          background-size: 300% 300%;
          -webkit-mask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: border-gradient 3s ease infinite;
          z-index: 2;
          pointer-events: none;
        }

        .instruction-content {
          width: 100%;
          height: 100%;
          max-height: 370px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: #333 #121218;
        }

        .instruction-content::-webkit-scrollbar {
          width: 4px;
        }

        .instruction-content::-webkit-scrollbar-track {
          background: #121218;
        }

        .instruction-content::-webkit-scrollbar-thumb {
          background-color: #333;
          border-radius: 4px;
        }

        .react-flow__node-instructionGroupNode {
          padding: 0;
          border-radius: 8px;
          width: auto;
          height: auto;
          border: none;
          background: transparent;
        }

        .flow-canvas {
          background-image: radial-gradient(#2a2d4a 1px, transparent 1px);
          background-size: 24px 24px;
          width: 100%;
          min-height: 600px;
        }

        .react-flow__handle {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #5d5dff;
          border: 1px solid #333;
        }

        .react-flow__handle-right {
          right: -3px;
        }

        .react-flow__handle-left {
          left: -3px;
        }

        .react-flow__controls {
          background: #0a0b14;
          border: 1px solid #2a2d4a;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .react-flow__controls-button {
          border: none;
          color: #5d5dff;
          background: #0a0b14;
        }

        .react-flow__controls-button:hover {
          background: #1e2033;
        }

        /* Enhanced Gradient edge styling */
        .gradient-edge path {
          stroke-dasharray: 5, 5;
          stroke: url(#edge-gradient) !important;
          animation: flowEdgeGradient 3s linear infinite, gradientPulse 3s ease-in-out infinite;
          stroke-linecap: round;
          filter: drop-shadow(0 0 3px rgba(28, 246, 160, 0.5));
        }

        @keyframes flowEdgeGradient {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        /* Improved glow effect to the edges */
        .gradient-edge path {
          filter: drop-shadow(0 0 3px rgba(28, 246, 160, 0.5));
        }

        /* Enhanced style for the edge arrow markers */
        .react-flow__arrowhead {
          fill: url(#edge-gradient) !important;
          filter: drop-shadow(0 0 2px rgba(28, 246, 160, 0.5));
        }

        /* Update SmoothStep edges specifically */
        .react-flow__edge.smoothstep .react-flow__edge-path {
          stroke-width: 3;
        }

        /* Make the gradient more visible */
        .react-flow__edge.animated.gradient-edge .react-flow__edge-path {
          stroke: url(#edge-gradient) !important;
          stroke-width: 3;
          stroke-dasharray: 5, 5;
          animation: flowEdgeGradient 3s linear infinite, gradientPulse 3s ease-in-out infinite;
        }

        @keyframes gradientPulse {
          0%, 100% { 
            filter: drop-shadow(0 0 2px rgba(28, 246, 160, 0.3)); 
          }
          50% { 
            filter: drop-shadow(0 0 4px rgba(28, 246, 160, 0.6));
          }
        }

        /* Ensure the default stroke isn't overriding the gradient */
        .react-flow__edge-path {
          stroke: none;
        }

        /* Make sure the edge interactivity is preserved */
        .react-flow__edge {
          pointer-events: stroke;
        }

        /* Ensure marker ends are properly visible */
        .react-flow__edge .react-flow__edge-path {
          marker-end: url(#gradient-arrow);
        }

        @keyframes dashdraw {
          0% {
            stroke-dashoffset: 10;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  )
}