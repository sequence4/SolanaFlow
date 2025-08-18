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
        'chat-bg': 'oklch(0.245 0 0)',
        'chat-bg-secondary': 'oklch(0.275 0 0)',
        'chat-border': 'oklch(0.309 0 0)',
        'chat-bubble-ai': 'oklch(0.309 0 0)',
        'chat-bubble-user': '#3b4f94',
        'chat-bubble-border': 'oklch(0.329 0 0)',
        'chat-icon-bg': 'oklch(0.329 0 0)',
        'chat-gradient-from': '#4a63b9',
        'chat-gradient-to': '#5a73c9',
        'chat-gradient-hover-from': '#3b4f94',
        'chat-gradient-hover-to': '#4a63b9',
        // Solana terminal custom colors
        solana: {
          purple: "#9945FF",
          green: "#14F195",
          pink: "#FF3B9A",
          dark: "oklch(0.245 0 0)",
          "dark-accent": "oklch(0.285 0 0)",
          "border-dark": "oklch(0.329 0 0)",
          "text-muted": "#5A5F73",
        },
        // Instruction node V0 colors
        instruction: {
          'background': 'oklch(0.245 0 0)',
          'secondary-bg': 'oklch(0.275 0 0)',
          'section-bg': 'oklch(0.309 0 0)',
          'border': 'oklch(0.329 0 0)',
          'text': '#e1e2e6',
          'text-muted': '#888',
          'purple': '#5d5dff',
          'green': '#36b37e',
          'yellow': '#d69e2e',
          'red': '#e53e3e',
          'badge-bg': 'oklch(0.245 0 0)',
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