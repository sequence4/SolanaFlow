import { useLayoutEffect } from "react";

export function useAutoScale(
  ref: React.RefObject<HTMLElement>,
  navH = 64
) {
  useLayoutEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    function resize() {
      const avail = window.innerHeight - navH;

      const need  = el.scrollHeight;

      const s = need > avail ? avail / need : 1;

      el.style.setProperty("--hero-scale", String(s));
      el.style.transform = `scale(${s})`;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [ref, navH]);
} 