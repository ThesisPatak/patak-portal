export const COLORS = {
  // Professional gradient blues
  primary: '#0055cc',      // Deep professional blue
  primaryLight: '#0066ff', // Bright accent blue
  primaryDark: '#003d99',  // Dark blue for emphasis
  
  // Semantic colors
  success: '#1a9d3c',      // Green for active/paid
  warning: '#d67700',      // Orange for alerts
  danger: '#c01818',       // Red for critical
  info: '#0055cc',         // Info color
  
  // Text hierarchy
  text: '#1a202c',         // Primary text (very dark)
  textSecondary: '#4a5568', // Secondary text
  muted: '#718096',        // Muted/hint text
  disabled: '#cbd5e0',     // Disabled state
  
  // Background & Surface
  background: '#f8f9fa',   // Light professional background
  surface: '#ffffff',      // Card surfaces
  cardBg: '#ffffff',       // Card background
  overlay: 'rgba(26, 32, 44, 0.7)', // Dark overlay
  
  // UI Elements
  border: '#cbd5e0',       // Professional gray border
  divider: '#e2e8f0',      // Light divider
  shadow: 'rgba(0, 0, 0, 0.08)', // Subtle shadow
  
  // Utility
  accent: '#0066ff',       // Accent color
  link: '#0055cc',         // Link color
  onPrimary: '#ffffff'     // Text on primary color
};

export const SPACING = {
  base: 14,
  small: 8,
  large: 20,
  xlarge: 28
};

export const TYPO = {
  // Heading hierarchy
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  
  // Body text
  bodySize: 16,
  bodySmall: 14,
  
  // Labels & captions
  labelSize: 13,
  captionSize: 12,
  
  // Legacy support
  titleSize: 24,
  subtitleSize: 18,
  smallSize: 12
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  base: 12,
  lg: 16,
  xl: 20,
  pill: 999
};

export const ELEVATION = {
  none: 0,
  low: 1,
  medium: 2,
  high: 4,
  xlarge: 6,
  xxlarge: 8
};

export default { COLORS, SPACING, TYPO };
