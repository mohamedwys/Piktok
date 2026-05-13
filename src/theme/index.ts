/**
 * Single source of truth for design tokens.
 *
 * Do not hardcode colors, spacing, radii, or typography values
 * elsewhere in the app. To change the brand accent, edit
 * `colors.brand` in this file — every consumer will pick it up.
 *
 * The matching human-readable source of truth is `BRAND.md` at the
 * repo root. Tokens added here must be added there too.
 */

import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './palettes';

const colors = dark;

const spacing = {
  0: 0,
  xs: 4,
  sm: 8,
  10: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const

const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  legacy: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const

const typography = {
  family: {
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemibold: 'Inter_600SemiBold',
    sansBold: 'Inter_700Bold',
    display: 'Fraunces_500Medium',
    displayRegular: 'Fraunces_400Regular',
    displaySemibold: 'Fraunces_600SemiBold',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    hero: 44,
  },
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.45,
    relaxed: 1.6,
  },
  tracking: {
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    ultraWide: 1.2,
  },
} as const

const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
    slower: 480,
  },
  spring: {
    gentle: { damping: 18, stiffness: 160 },
    snappy: { damping: 14, stiffness: 220 },
  },
} as const

const elevation = {
  surface: { borderColor: colors.border },
  surfaceElevated: { borderColor: colors.borderStrong },
} as const

const zIndex = {
  feed: 0,
  overlay: 10,
  sheet: 20,
  toast: 30,
  modal: 40,
  debug: 99,
} as const

const blur = {
  intensity: {
    subtle: 20,
    regular: 40,
    strong: 70,
  },
  tint: 'dark',
} as const

/**
 * Variant maps for the Text primitive (`src/components/ui/Text.tsx`).
 * Resolved up-front so the primitive does no per-render math.
 */
const textVariants = {
  display: {
    family: typography.family.display,
    size: typography.size.hero,
    weight: typography.weight.medium,
    lineHeight: typography.lineHeight.tight,
    tracking: typography.tracking.tight,
  },
  title: {
    family: typography.family.sansSemibold,
    size: typography.size.xl,
    weight: typography.weight.semibold,
    lineHeight: typography.lineHeight.snug,
    tracking: typography.tracking.normal,
  },
  body: {
    family: typography.family.sans,
    size: typography.size.md,
    weight: typography.weight.regular,
    lineHeight: typography.lineHeight.normal,
    tracking: typography.tracking.normal,
  },
  caption: {
    family: typography.family.sans,
    size: typography.size.sm,
    weight: typography.weight.regular,
    lineHeight: typography.lineHeight.normal,
    tracking: typography.tracking.normal,
  },
  label: {
    family: typography.family.sansSemibold,
    size: typography.size.xs,
    weight: typography.weight.semibold,
    lineHeight: typography.lineHeight.normal,
    tracking: typography.tracking.ultraWide,
  },
} as const

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  motion,
  elevation,
  zIndex,
  blur,
  textVariants,
} as const

export {
  colors,
  spacing,
  radii,
  typography,
  motion,
  elevation,
  zIndex,
  blur,
  textVariants,
}

export type Theme = typeof theme
export type TextVariant = keyof typeof textVariants
export type TextColorKey = keyof typeof colors.text
export type WeightKey = keyof typeof typography.weight
export type FamilyKey = 'sans' | 'display'
export type SpacingKey = keyof typeof spacing
export type RadiusKey = keyof typeof radii
export type GlassVariant = keyof typeof colors.glass
export type BlurIntensityKey = keyof typeof blur.intensity

export function useThemeColors(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}

export type { Palette };
