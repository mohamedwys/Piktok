/**
 * Web theme module — companion to the mobile theme at
 * `src/theme/index.ts` (in the React Native codebase).
 *
 * Most design tokens are exposed via Tailwind classes through
 * `tailwind.config.ts`. This module exists for the cases where
 * Tailwind isn't the right consumer — e.g., theme-aware utilities
 * for inline `style={{ ... }}` props, animation timing constants
 * passed to motion libraries, or color values consumed by
 * non-CSS contexts (Stripe Elements appearance config, OG image
 * generation, etc.).
 *
 * The mobile theme remains the authoritative source. When mobile
 * adds a token, mirror it both here and in `tailwind.config.ts`.
 *
 * For v1 scaffold this module ships only the brand color subset
 * — enough for the placeholder pages. Phase H.7+ extends it as
 * the surface area grows (e.g., the upgrade page may need a
 * Stripe Elements `appearance` config that consumes tokens
 * directly).
 */
export const theme = {
  colors: {
    brand: '#FF5A5C',
    brandPressed: '#E04547',
    brandMuted: 'rgba(255, 90, 92, 0.16)',
    brandText: '#FFFFFF',

    background: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#161616',
    surfaceOverlay: 'rgba(255,255,255,0.04)',

    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',

    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255,255,255,0.68)',
      tertiary: 'rgba(255,255,255,0.42)',
      inverse: '#000000',
    },

    verified: '#3B82F6',
    proBadge: '#8B5CF6',
    proBadgeText: '#FFFFFF',

    feedback: {
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
    },
  },
} as const;

export type Theme = typeof theme;
