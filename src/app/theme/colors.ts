export const colors = {
  background: '#ffffff',
  foreground: '#111111',
  primary: '#6b4dff',
  muted: '#6b7280',
} as const;

export type ColorToken = keyof typeof colors;
