import { useLayoutEffect } from "react";

export function useAutoScale(
  ref: React.RefObject<HTMLElement>,
  navH = 64               // keep in sync with your var(--navH)
) {
  useLayoutEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    function resize() {
      // total space we're allowed to use
      const avail = window.innerHeight - navH;

      // how tall the hero really is right now
      const need  = el.scrollHeight;

      // scale only if we overflow
      const s = need > avail ? avail / need : 1;

      el.style.setProperty("--hero-scale", String(s));
      el.style.transform = `scale(${s})`;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [ref, navH]);
} 