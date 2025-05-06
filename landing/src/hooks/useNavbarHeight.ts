"use client"

import { useLayoutEffect, useState } from 'react';

export function useNavbarHeight() {
  const [navbarHeight, setNavbarHeight] = useState(64); // Default height

  useLayoutEffect(() => {
    const updateNavbarHeight = () => {
      const navElement = document.getElementById('site-nav');
      if (navElement) {
        const height = navElement.offsetHeight;
        setNavbarHeight(height);
        document.documentElement.style.setProperty('--navH', `${height}px`);
      }
    };

    // Initial calculation
    updateNavbarHeight();

    // Recalculate on resize
    window.addEventListener('resize', updateNavbarHeight);
    
    // Also recalculate when device orientation changes
    window.addEventListener('orientationchange', updateNavbarHeight);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      window.removeEventListener('orientationchange', updateNavbarHeight);
    };
  }, []);

  return navbarHeight;
} 