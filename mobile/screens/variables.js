export const COLORS = {
  // Neon crypto aesthetic
  primary: '#00f9ff',      // Neon cyan
  primaryLight: '#00ffff', // Bright cyan
  primaryDark: '#00d4d4',  // Dark cyan
  
  // Semantic colors
  success: '#00ff88',      // Neon green
  warning: '#ffeb00',      // Neon yellow
  danger: '#ff0055',       // Neon pink/red
  info: '#00d4ff',         // Cyan info
  
  // Text hierarchy
  text: '#e0f2f1',         // Light text for dark bg
  textSecondary: '#b0bec5', // Secondary text
  muted: '#78909c',        // Muted/hint text
  disabled: '#455a64',     // Disabled state
  
  // Background & Surface
  background: '#0a1628',   // Dark teal background
  surface: '#0f2438',      // Card surfaces (slightly lighter)
  cardBg: '#0f2438',       // Card background with transparency
  overlay: 'rgba(10, 22, 40, 0.8)', // Dark teal overlay
  
  // UI Elements
  border: '#1a3a52',       // Dark cyan border
  divider: '#1a3a52',      // Dark divider
  shadow: 'rgba(0, 249, 255, 0.15)', // Cyan glow shadow
  
  // Utility
  accent: '#00ff88',       // Green accent
  link: '#00f9ff',         // Cyan link
  onPrimary: '#0a1628',    // Dark text on neon
  
  // Glow colors
  glowCyan: '#00f9ff',
  glowGreen: '#00ff88',
  glowYellow: '#ffeb00',
  glowPink: '#ff0055',
  glowBlue: '#00b4ff'
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
