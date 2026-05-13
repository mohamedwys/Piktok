// Dark palette is the canonical Mony palette today.
export const dark = {
  brand:        '#FF5A5C',
  brandPressed: '#E04547',
  brandMuted:   'rgba(255, 90, 92, 0.16)',
  brandText:    '#FFFFFF',

  background:      '#000000',
  surface:         '#0A0A0A',
  surfaceElevated: '#161616',
  surfaceOverlay:  'rgba(255,255,255,0.04)',

  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  text: {
    primary:   '#FFFFFF',
    secondary: 'rgba(255,255,255,0.68)',
    tertiary:  'rgba(255,255,255,0.42)',
    inverse:   '#000000',
  },

  overlay: {
    scrim:     'rgba(0,0,0,0.55)',
    scrimSoft: 'rgba(0,0,0,0.35)',
  },

  feedback: {
    success: '#34D399',
    warning: '#FBBF24',
    danger:  '#F87171',
    gold:    '#FFC83D',
  },

  verified:     '#3B82F6',
  proBadge:     '#8B5CF6',
  proBadgeText: '#FFFFFF',

  glass: {
    dark: {
      bg:     'rgba(0, 0, 0, 0.45)',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    darkStrong: {
      bg:     'rgba(0, 0, 0, 0.6)',
      border: 'rgba(255, 255, 255, 0.10)',
    },
  },
} as const;

// Light palette — designed for a future light-mode pass. NO screen consumes
// this yet; ship structure-parity with dark so the eventual migration is
// mechanical.
export const light = {
  brand:        '#FF5A5C',
  brandPressed: '#D8403F',
  brandMuted:   'rgba(255, 90, 92, 0.12)',
  brandText:    '#FFFFFF',

  background:      '#FFFFFF',
  surface:         '#F4F4F5',
  surfaceElevated: '#FFFFFF',
  surfaceOverlay:  'rgba(0,0,0,0.04)',

  border:       'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.16)',

  text: {
    primary:   '#0A0A0A',
    secondary: 'rgba(10,10,10,0.68)',
    tertiary:  'rgba(10,10,10,0.42)',
    inverse:   '#FFFFFF',
  },

  overlay: {
    scrim:     'rgba(0,0,0,0.55)',
    scrimSoft: 'rgba(0,0,0,0.35)',
  },

  feedback: {
    success: '#15803D',
    warning: '#B45309',
    danger:  '#B91C1C',
    gold:    '#B45309',
  },

  verified:     '#1D4ED8',
  proBadge:     '#6D28D9',
  proBadgeText: '#FFFFFF',

  glass: {
    dark: {
      bg:     'rgba(255, 255, 255, 0.72)',
      border: 'rgba(0, 0, 0, 0.08)',
    },
    darkStrong: {
      bg:     'rgba(255, 255, 255, 0.85)',
      border: 'rgba(0, 0, 0, 0.10)',
    },
  },
} as const;

// Widens each leaf `as const` literal in T to plain `string`. Both `dark`
// and `light` are `as const` (so the dark `colors` export keeps its literal
// types and consumer code is bit-identical), but `useThemeColors` must
// return one OR the other — so the Palette contract has to admit both
// shapes. Without widening, `typeof light !== typeof dark` and the ternary
// in the hook would not typecheck.
type Widen<T> = T extends string
  ? string
  : T extends object
    ? { -readonly [K in keyof T]: Widen<T[K]> }
    : T;

export type Palette = Widen<typeof dark>;
