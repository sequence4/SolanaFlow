/* web/tailwind.config.js
   -----------------------------------------------------------
   CommonJS because the repo has `"type": "module"` in package.json.
   • dark-mode toggle
   • content globs for app/, components/, src/
   • full shadcn-ui colour tokens so utilities such as border-border work
   • extra keyframes / animation / safelist used by our templates
*/

const { fontFamily } = require("tailwindcss/defaultTheme");
const shadcnPreset   = require("@shadcn/ui/preset");   // ⬅ load native preset

/** @type {import('tailwindcss').Config} */
module.exports = {
  /* shadcn/ui supplies its own base tokens & utilities (e.g. `border-border`).
     Loading the preset means we no longer need to hand-maintain the colour map. */
  presets: [shadcnPreset],
  darkMode: ["class", "class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
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
  plugins: [require("tailwindcss-animate")],
  safelist: [
    "scale-[1.02]", "blur-3xl",
    "bg-gradient-to-r", "from-blue-500", "to-purple-500",
    "hover:from-blue-600", "hover:to-purple-600",
    "hover:scale-105", "shadow-lg",
  ],
};

