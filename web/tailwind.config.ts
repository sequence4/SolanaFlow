import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'      // lightweight preset

const config: Config = {
  content: [/* … */],

  /** expose the CSS-vars shadcn/ui expects (border, ring, …) */
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
      },
    },
  },

  plugins: [animatePlugin],
}

export default config 