/**
 * Unified Color System and Theme Constants
 * AI-Inspired Dark Theme following 2024-2025 best practices
 */

export const theme = {
  // Core Dark Theme Palette
  colors: {
    bg: {
      primary: '#0a0a0b',         // Deepest background
      secondary: '#111113',       // Panels and cards
      tertiary: '#1a1a1d',        // Elevated surfaces
      hover: 'rgba(255,255,255,0.05)', // Hover states
    },
    border: {
      primary: 'rgba(255,255,255,0.08)',  // Main borders
      secondary: 'rgba(255,255,255,0.05)', // Subtle borders
      accent: 'rgba(77,124,254,0.3)',      // Active/focus borders
    },
    text: {
      primary: 'rgba(255,255,255,0.87)',   // Main text (87% opacity)
      secondary: 'rgba(255,255,255,0.60)', // Secondary text (60% opacity)
      tertiary: 'rgba(255,255,255,0.38)',  // Disabled/hints (38% opacity)
    },
    accent: {
      primary: '#4d7cfe',      // Primary blue
      success: '#22c55e',      // Success green
      warning: '#f59e0b',      // Warning amber
      danger: '#ef4444',       // Error red
      info: '#06b6d4',         // Info cyan
      purple: '#a855f7',       // Purple accent
    },
    // Glassmorphism
    glass: {
      bg: 'rgba(17,17,19,0.7)',
      border: 'rgba(255,255,255,0.06)',
      blur: '12px',
    },
  },
  
  // 8px Grid System
  spacing: {
    xs: '4px',    // 0.5 * 8
    sm: '8px',    // 1 * 8
    md: '16px',   // 2 * 8
    lg: '24px',   // 3 * 8
    xl: '32px',   // 4 * 8
    '2xl': '40px', // 5 * 8
    '3xl': '48px', // 6 * 8
    '4xl': '56px', // 7 * 8
    '5xl': '64px', // 8 * 8
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
    },
    fontSize: {
      xs: '10px',
      sm: '12px',
      base: '14px',
      lg: '16px',
      xl: '18px',
      '2xl': '20px',
      '3xl': '24px',
    },
    lineHeight: {
      tight: '1.4',
      normal: '1.5',
      relaxed: '1.6',
    },
  },
  
  // Shadows and Effects
  effects: {
    shadow: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
      glow: '0 0 20px rgba(77, 124, 254, 0.3)',
    },
    blur: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
    },
  },
  
  // Animation
  animation: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
} as const;

// CSS Custom Properties for Tailwind integration
export const cssVariables = `
  :root {
    --bg-primary: ${theme.colors.bg.primary};
    --bg-secondary: ${theme.colors.bg.secondary};
    --bg-tertiary: ${theme.colors.bg.tertiary};
    --bg-hover: ${theme.colors.bg.hover};
    
    --border-primary: ${theme.colors.border.primary};
    --border-secondary: ${theme.colors.border.secondary};
    --border-accent: ${theme.colors.border.accent};
    
    --text-primary: ${theme.colors.text.primary};
    --text-secondary: ${theme.colors.text.secondary};
    --text-tertiary: ${theme.colors.text.tertiary};
    
    --accent-primary: ${theme.colors.accent.primary};
    --accent-success: ${theme.colors.accent.success};
    --accent-warning: ${theme.colors.accent.warning};
    --accent-danger: ${theme.colors.accent.danger};
    --accent-info: ${theme.colors.accent.info};
    --accent-purple: ${theme.colors.accent.purple};
    
    --glass-bg: ${theme.colors.glass.bg};
    --glass-border: ${theme.colors.glass.border};
    --blur-strength: ${theme.colors.glass.blur};
  }
`;

// Utility functions
export const getTextOpacity = (level: 'primary' | 'secondary' | 'tertiary') => {
  const opacities = {
    primary: '87',
    secondary: '60', 
    tertiary: '38'
  };
  return opacities[level];
};

export const getGradientClasses = (color: keyof typeof theme.colors.accent) => {
  const gradients = {
    primary: 'from-blue-500 to-cyan-500',
    success: 'from-emerald-500 to-teal-500',
    warning: 'from-orange-500 to-amber-500',
    danger: 'from-red-500 to-pink-500',
    info: 'from-cyan-500 to-blue-500',
    purple: 'from-purple-500 to-pink-500',
  };
  return gradients[color] || gradients.primary;
};