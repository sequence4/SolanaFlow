/**
 * Unified Color System and Theme Constants
 * Complete Frontend Style Unification for SolanaFlow
 */

export const darkTheme = {
  // Primary backgrounds - USE THESE CONSISTENTLY
  background: {
    primary: '#0a0a0b',        // Main app background
    secondary: '#0f0f11',      // Panels, sidebars, modals
    tertiary: '#141416',       // Cards, elevated surfaces
    canvas: '#0a0a0b',         // Workflow canvas - SAME as primary
  },
  
  // Glassmorphism
  glass: {
    background: 'rgba(15, 15, 17, 0.6)',
    border: 'rgba(255, 255, 255, 0.06)',
    blur: '16px',
  },
  
  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.06)',
    hover: 'rgba(255, 255, 255, 0.1)',
    active: 'rgba(77, 124, 254, 0.4)',
  },
  
  // Text
  text: {
    primary: 'rgba(255, 255, 255, 0.9)',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.4)',
  },
  
  // Accents
  accent: {
    blue: '#4d7cfe',
    green: '#22c55e',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    red: '#ef4444',
  },
  
  // Node styling constants
  node: {
    background: 'rgba(15, 15, 17, 0.8)',
    border: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '12px 16px',
    minWidth: '200px',
    shadow: '0 4px 6px rgba(0, 0, 0, 0.3), 0 0 20px rgba(77, 124, 254, 0.1)',
    hoverShadow: '0 4px 6px rgba(0, 0, 0, 0.3), 0 0 30px rgba(77, 124, 254, 0.2)',
    headerBackground: 'linear-gradient(90deg, rgba(77, 124, 254, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
  },
};

// Legacy theme export for backward compatibility
export const theme = {
  colors: {
    bg: {
      primary: darkTheme.background.primary,
      secondary: darkTheme.background.secondary,
      tertiary: darkTheme.background.tertiary,
      hover: darkTheme.glass.background,
    },
    border: {
      primary: darkTheme.border.default,
      secondary: darkTheme.border.default,
      accent: darkTheme.border.active,
    },
    text: {
      primary: darkTheme.text.primary,
      secondary: darkTheme.text.secondary,
      tertiary: darkTheme.text.tertiary,
    },
    accent: {
      primary: darkTheme.accent.blue,
      success: darkTheme.accent.green,
      warning: '#f59e0b',
      danger: '#ef4444',
      info: darkTheme.accent.cyan,
      purple: darkTheme.accent.purple,
    },
    glass: {
      bg: darkTheme.glass.background,
      border: darkTheme.glass.border,
      blur: darkTheme.glass.blur,
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