import { useEffect } from 'react'

/**
 * Sets a CSS variable --hero-scale based on available viewport height
 * This ensures the hero section scales properly on all screen sizes
 * 
 * @param designHeight - The height you designed the hero for (below navbar)
 * @param navH - The height of your fixed navbar
 */
export function useHeroScale(designHeight = 920, navH = 64) {
  useEffect(() => {
    const el = document.documentElement
    const calc = () => {
      const avail = window.innerHeight - navH            // real space
      const s = Math.min(1, avail / designHeight)        // never > 1
      el.style.setProperty('--hero-scale', String(s))
    }
    calc()                      // 1️⃣  run once
    window.addEventListener('resize', calc) // 2️⃣  run on resize
    return () => window.removeEventListener('resize', calc)
  }, [designHeight, navH])
} 