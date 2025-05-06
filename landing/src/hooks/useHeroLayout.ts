import { useEffect } from "react"

export function useHeroLayout(heroIdeal = 860, navH = 64) {
  useEffect(() => {
    function recalc() {
      const avail = window.innerHeight - navH
      const breath = Math.max(16, Math.min(64, (avail - heroIdeal) / 2))
      const scale = Math.min(1, (avail - breath * 2) / heroIdeal)

      const root = document.documentElement
      root.style.setProperty("--hero-breath", breath + "px")
      root.style.setProperty("--hero-scale", scale.toString())
    }

    // Initial calculation
    recalc()
    
    // Recalculate on resize
    window.addEventListener("resize", recalc)
    
    // Also recalculate after a small delay to ensure DOM is fully loaded
    const timeout = setTimeout(recalc, 100)
    
    return () => {
      window.removeEventListener("resize", recalc)
      clearTimeout(timeout)
    }
  }, [heroIdeal, navH])
} 