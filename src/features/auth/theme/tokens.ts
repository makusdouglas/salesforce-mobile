export const colors = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  primary: '#18181B',
  primaryForeground: '#FAFAFA',
  muted: '#F4F4F5',
  mutedForeground: '#71717A',
  border: '#E4E4E7',
  placeholder: '#A1A1AA',
  destructive: '#EF4444',
  destructiveForeground: '#FAFAFA',
  overlay: 'rgba(10, 10, 10, 0.70)',
} as const;

export const radii = {
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 22,
  display: 30,
} as const;

export const font = {
  family: 'Inter',
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
