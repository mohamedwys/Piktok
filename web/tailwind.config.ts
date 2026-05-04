import type { Config } from 'tailwindcss';

/**
 * Tailwind config — port of the mobile design tokens at
 * `src/theme/index.ts` in the React Native codebase.
 *
 * Single source of truth on the mobile side stays the typed `theme`
 * module (and BRAND.md as the human-readable companion). When mobile
 * tokens change, mirror them here. The two codebases ship to
 * different runtimes (React Native StyleSheet vs Tailwind CSS) but
 * the values must stay 1:1 so a Pro seller toggling between mobile
 * and web sees the same visual identity.
 *
 * Dark-only by design (BRAND.md "Mode: Dark-first only for v1").
 * The `dark` class is forced on `<html>` in `app/layout.tsx` so the
 * `dark:` variant becomes the steady state — light mode is not
 * implemented and intentionally not stubbed.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — coral red, the only "loud" color in the system.
        // Reserved for buy-moment / action / brand surfaces only.
        brand: '#FF5A5C',
        'brand-pressed': '#E04547',
        'brand-muted': 'rgba(255, 90, 92, 0.16)',
        'brand-text': '#FFFFFF',

        // Dark-stack elevation. Each surface is one step up from
        // the previous; we use surface stack + borders for elevation,
        // never shadows (shadows don't read on black).
        background: '#000000',
        surface: '#0A0A0A',
        'surface-elevated': '#161616',
        'surface-overlay': 'rgba(255,255,255,0.04)',

        // Borders carry the rest of the elevation signal.
        border: 'rgba(255,255,255,0.08)',
        'border-strong': 'rgba(255,255,255,0.16)',

        // Text — flattened from `colors.text.{primary,secondary,…}`
        // to Tailwind-friendly kebab-case. `text-text-primary` reads
        // a bit redundant but keeps the namespace clear.
        'text-primary': '#FFFFFF',
        'text-secondary': 'rgba(255,255,255,0.68)',
        'text-tertiary': 'rgba(255,255,255,0.42)',
        'text-inverse': '#000000',

        // Status accents (BRAND.md §Status Tokens) — distinct from
        // brand so they don't compete with conversion surfaces.
        verified: '#3B82F6',
        'pro-badge': '#8B5CF6',
        'pro-badge-text': '#FFFFFF',

        // Feedback — system-only, never decorative.
        'feedback-success': '#34D399',
        'feedback-warning': '#FBBF24',
        'feedback-danger': '#F87171',

        // Overlays for media scrim.
        'overlay-scrim': 'rgba(0,0,0,0.55)',
        'overlay-scrim-soft': 'rgba(0,0,0,0.35)',
      },

      // Mirror mobile's radius scale verbatim. Tailwind names map
      // 1:1 to mobile token keys.
      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '8px',
        md: '12px',
        legacy: '14px',
        lg: '16px',
        xl: '20px',
        xxl: '28px',
        pill: '9999px',
      },

      // Mirror mobile's spacing scale. Tailwind already provides 4px
      // increments by default (1=4, 2=8, 3=12, 4=16, …); we add the
      // named tokens for explicit references that match mobile.
      spacing: {
        xs: '4px',
        sm: '8px',
        '10': '10px', // legacy SellerCard parity (BRAND.md §Component Sizing)
        md: '12px',
        lg: '16px',
        xl: '20px',
        xxl: '24px',
        xxxl: '32px',
        huge: '48px',
      },

      // Inter (sans) + Fraunces (display) — loaded via next/font in
      // app/layout.tsx, exposed as CSS vars consumed below.
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },

      fontSize: {
        // Mirror mobile's typography.size scale (in pt; we render in
        // px since web doesn't have RN's auto-scaling).
        xs: ['11px', { lineHeight: '1.45' }],
        sm: ['13px', { lineHeight: '1.45' }],
        md: ['15px', { lineHeight: '1.45' }],
        lg: ['17px', { lineHeight: '1.45' }],
        xl: ['20px', { lineHeight: '1.3' }],
        xxl: ['24px', { lineHeight: '1.3' }],
        xxxl: ['32px', { lineHeight: '1.15' }],
        hero: ['44px', { lineHeight: '1.15' }],
      },

      letterSpacing: {
        tight: '-0.4px',
        normal: '0',
        wide: '0.4px',
        ultraWide: '1.2px',
      },
    },
  },
  plugins: [],
};

export default config;
