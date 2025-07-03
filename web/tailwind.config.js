/* web/tailwind.config.js
   -----------------------------------------------------------
   CommonJS because the repo has `"type": "module"` in package.json.
   • dark-mode toggle
   • content globs for app/, components/, src/
   • full shadcn-ui colour tokens so utilities such as border-border work
   • extra keyframes / animation / safelist used by our templates
*/

const { fontFamily } = require("tailwindcss/defaultTheme");
const { createPreset } = require("tailwindcss-shadcn-ui"); // ⬅ official preset

/** @type {import('tailwindcss').Config} */
module.exports = {
  /* shadcn preset exposes the colour tokens & utilities (`border-border`, …) */
  presets: [createPreset()],
  darkMode: ["class", "class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
      /* --- shadcn design-tokens so utilities like border-border work --- */
      colors: {
        border:       "hsl(var(--border))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
      },
  		fontFamily: {
  			sans: ["var(--font-sans)", ...fontFamily.sans]
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  /* shadcn-ui plugin must be loaded via its explicit helper */
  plugins: [
    require("tailwindcss-animate")
  ],
  safelist: [
    "scale-[1.02]", "blur-3xl",
    "bg-gradient-to-r", "from-blue-500", "to-purple-500",
    "hover:from-blue-600", "hover:to-purple-600",
    "hover:scale-105", "shadow-lg",
  ],
};

