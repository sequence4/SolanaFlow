"use client"

import { useLayoutEffect, useState } from 'react';

export function useNavbarHeight() {
  const [navbarHeight, setNavbarHeight] = useState(64);

  useLayoutEffect(() => {
    const updateNavbarHeight = () => {
      const navElement = document.getElementById('site-nav');
      if (navElement) {
        const height = navElement.offsetHeight;
        setNavbarHeight(height);
        document.documentElement.style.setProperty('--navH', `${height}px`);
      }
    };

    updateNavbarHeight();

    window.addEventListener('resize', updateNavbarHeight);
    
    window.addEventListener('orientationchange', updateNavbarHeight);
    
    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      window.removeEventListener('orientationchange', updateNavbarHeight);
    };
  }, []);

  return navbarHeight;
} 