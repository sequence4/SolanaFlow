import { useEffect } from 'react'

export function useHeroScale(designHeight = 920, navH = 64) {
  useEffect(() => {
    const el = document.documentElement
    const calc = () => {
      const avail = window.innerHeight - navH 
      const s = Math.min(1, avail / designHeight)
      el.style.setProperty('--hero-scale', String(s))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [designHeight, navH])
} 