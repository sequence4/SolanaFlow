/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Chat component custom colors
      colors: {
        'chat-bg': '#181818',
        'chat-bg-secondary': '#1a1a1a',
        'chat-border': '#2a2d3a',
        'chat-bubble-ai': '#2a2d36',
        'chat-bubble-user': '#3b4f94',
        'chat-bubble-border': '#3a3d46',
        'chat-icon-bg': '#3a3d46',
        'chat-gradient-from': '#4a63b9',
        'chat-gradient-to': '#5a73c9',
        'chat-gradient-hover-from': '#3b4f94',
        'chat-gradient-hover-to': '#4a63b9',
        // Solana terminal custom colors
        solana: {
          purple: "#9945FF",
          green: "#14F195",
          pink: "#FF3B9A",
          dark: "#0F1424",
          "dark-accent": "#1A1F35",
          "border-dark": "#2A2F45",
          "text-muted": "#5A5F73",
        },
        // Instruction node V0 colors
        instruction: {
          'background': '#121218',
          'secondary-bg': '#1a1a24',
          'section-bg': '#2a2a2d',
          'border': '#333',
          'text': '#e1e2e6',
          'text-muted': '#888',
          'purple': '#5d5dff',
          'green': '#36b37e',
          'yellow': '#d69e2e',
          'red': '#e53e3e',
          'badge-bg': '#121218',
        }
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        blink: "blink 1s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("tailwindcss-scrollbar")],
}; 