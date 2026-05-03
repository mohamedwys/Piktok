## Single source of truth

This document is the **single source of truth** for the brand and design system. The matching code-side source of truth is the typed `theme` module exported from `src/theme/index.ts`. Anyone hardcoding a color, spacing value, radius, or typeface anywhere else in the app is breaking the contract.

If a value is not in this document and not in `src/theme`, it does not exist. If you need a new token, add it here first, then add it to the theme module, then consume it.

To swap the brand accent, edit `colors.brand` in one place. The system was designed to make that a single-line change.

---

## Identity

**Name:** TBD. Use the placeholder `Marketplace` only as a display string. **Do not** bake any candidate name into file names, folder names, component names, store keys, Supabase tables, env vars, or bundle identifiers. The current bundle id (`com.pictok.client`) and product name (`Pictok`) are legacy and will be retired in a later step — do not propagate them into new code.

**Positioning:** A premium, dark, video-first marketplace. Should feel as considered as Apple Music while browsing and as energizing as Whatnot when buying. The host range is wide — from a casual seller offloading one thing to a real boutique running a storefront — but the product never feels casual.

**Audience:** Buyers who treat shopping as discovery, not transactional search. Sellers who care how their listings look. Both expect mobile-native polish, not a CMS-grade web experience squeezed into a phone.

---

## Visual Language

**Aesthetic.** Apple Music restraint with Whatnot conversion energy. Dark, deep, generous. The accent is the only loud color in the system; everything else is a quiet stack of grays.

**Density.** Generous, never dense. We let things breathe. If a screen looks tight, the answer is more space, not smaller type.

**Geometry.** Medium-rounded.
- 14–20px radii on cards and sheets
- pill (999) on chips, segmented controls, primary CTAs
- 4px on inputs

**Motion.** Spring-based via Reanimated 4. Things settle, they do not snap. Subtle haptics on key actions (buy, like, send) — never on every tap.

**Glass.** iOS-style blur surfaces over the video feed. Introduced in Step 3; the `expo-blur` dependency and theme tokens land in Step 2 so the rest of the stack can reference them.

**Mode.** Dark-first only for v1. Light mode is explicitly out of scope and should not be designed for, planned for, or stubbed.

### Layout Decisions

These are settled judgment calls. Don't re-litigate without strong new evidence.

- **Top header uses adjacent tab switch** (Pour toi / Marketplace) with a 2px white underline indicating the active tab, and a glass Search button on the right. The reference image's asymmetric "Pour toi" pill placement was tested and rejected — it doesn't read as a tab relationship in practice. If a future audit suggests the asymmetric layout, ignore the suggestion or escalate first.
- **The Search button is fixed to the trailing edge.** It is not part of the tab cluster and must not be moved into it.

### Component Sizing

Locked dimensions. Don't grow these unless the user asks.

- **`SellerPill`** mirrors the legacy `SellerCard` footprint (visual continuity for users who were used to the pre-Step-4 layout). Avatar diameter `36` (via `Avatar diameter={36}` — non-token, intentional pixel-precise override), card padding `spacing[10]` (uniform 10), avatar↔text gap `spacing[10]`, border radius `radii.legacy` (14), name `fontSize: 14` `lineHeight: 18` `weight: bold`, all secondary text `fontSize: 12` `lineHeight: 16`. PRO badge sits on its own row (one structural row more than legacy) — heights match for non-PRO sellers (~56 px) and run ~14 px taller for PRO sellers because of the extra row. Removing the row would require a structural change, currently out of scope.
- **`SellerPill` and `PriceCard` both cap at `maxWidth: 320` with `flexShrink: 1`.** On iPhone these fit naturally. On iPad / wide viewports the cap stops them from scaling with the screen — they stay compact, anchored to the leading / trailing edge of the feed item. Don't remove the cap; if the design later wants larger feed-item cards, raise the cap deliberately.
- **`spacing[10]`** and **`radii.legacy`** were added to the theme specifically for legacy-card parity. They're not general-purpose: prefer the named scale for new code.

---

## Color System

The accent is **coral red `#FF5A5C`**. It is reserved for buy-moment, action, and brand surfaces. It is **not** a decorative color. If you find yourself reaching for it to "add some energy" to a screen, stop — the system is intentionally quiet so that coral registers as a signal when it appears.

### Contrast & Text on Brand

`brandText` is **white (`#FFFFFF`)**. White on coral `#FF5A5C` measures roughly **3.4:1** — this is **not** AA-compliant for body text. It does pass AA for large text (≥18pt regular / ≥14pt bold) and the WCAG **non-text contrast** threshold (3:1) for icons.

**Rules.**
- White on `colors.brand` is allowed for **icons** (any size) and **large text** (≥20px).
- White on `colors.brand` is **forbidden** for body text (under 20px). If a CTA needs body-sized text, switch the foreground to `colors.text.inverse` (black, ~5.0:1 on coral) or rethink the surface.
- Any UI surface filled with `colors.brand` MUST resolve its foreground through `colors.brandText` (icons / large) or `colors.text.inverse` (body), not through literal `'#fff'`. The indirection is what protects future accent swaps from silently regressing.
- Icons rendered on top of `colors.brand`: pass `color={colors.brandText}`, not `colors.text.primary` or a literal `'#fff'`.

**Reserved uses for `colors.brand`:**
- Primary CTA fills (Buy, Send, Sign in)
- Active state of selected segmented controls and toggles tied to a buy / sell action
- Liked / engaged states on the action rail
- Brand mark surfaces (splash, app icon accents)

**Forbidden uses:**
- Decorative dividers, borders, icons, or backgrounds
- Generic "selected" states for non-action UI (filter chips, tabs that are not action tabs, etc.)
- Body or label text outside of a CTA
- Loading/skeleton accents

| Token | Value | Usage |
| --- | --- | --- |
| `colors.brand` | `#FF5A5C` | Primary CTAs, buy-moment surfaces, brand marks. Reserved. |
| `colors.brandPressed` | `#E04547` | Pressed/active state of brand surfaces. Deterministic dark. |
| `colors.brandMuted` | `rgba(255, 90, 92, 0.16)` | Subtle brand-tinted chip background or selected-state fill. |
| `colors.brandText` | `#FFFFFF` | Icon / large-text foreground on `colors.brand`. ~3.4:1 on coral — icons and ≥20px text only. For body text on a brand fill, use `text.inverse`. |
| `colors.background` | `#000000` | App background. The base of the dark stack. |
| `colors.surface` | `#0A0A0A` | First elevation up from background — sheets, cards. |
| `colors.surfaceElevated` | `#161616` | Second elevation up — input fields, modals over surface. |
| `colors.surfaceOverlay` | `rgba(255,255,255,0.04)` | Translucent surface stacked on imagery (feed overlays). |
| `colors.border` | `rgba(255,255,255,0.08)` | Default hairline border on dark surfaces. |
| `colors.borderStrong` | `rgba(255,255,255,0.16)` | Emphasized border / divider. |
| `colors.text.primary` | `#FFFFFF` | Default body and title text. |
| `colors.text.secondary` | `rgba(255,255,255,0.68)` | Captions, supporting text. |
| `colors.text.tertiary` | `rgba(255,255,255,0.42)` | Meta, timestamps, low-emphasis labels. |
| `colors.text.inverse` | `#000000` | Black text — use on light fills, including body text on `colors.brand` (~5.0:1 on coral, AA body). |
| `colors.overlay.scrim` | `rgba(0,0,0,0.55)` | Strong scrim for legibility over media. |
| `colors.overlay.scrimSoft` | `rgba(0,0,0,0.35)` | Soft scrim for video gradients. |
| `colors.feedback.success` | `#34D399` | Positive system feedback only. Not a brand surface. |
| `colors.feedback.warning` | `#FBBF24` | Caution system feedback only. |
| `colors.feedback.danger` | `#F87171` | Errors and destructive confirmations only. |
| `colors.verified` | `#3B82F6` | Verified-account check overlay (avatar, name row). See **Status Tokens** below. |
| `colors.proBadge` | `#8B5CF6` | Professional-seller badge fill. See **Status Tokens** below. |
| `colors.proBadgeText` | `#FFFFFF` | Foreground text/icon on `colors.proBadge`. |
| `colors.glass.dark.bg` | `rgba(0, 0, 0, 0.45)` | Glass surface background (iOS uses `BlurView`; Android falls back to this solid tint). |
| `colors.glass.dark.border` | `rgba(255, 255, 255, 0.08)` | Glass surface hairline border (always pair). |
| `colors.glass.darkStrong.bg` | `rgba(0, 0, 0, 0.6)` | Stronger glass for higher-contrast overlays. |
| `colors.glass.darkStrong.border` | `rgba(255, 255, 255, 0.10)` | Border for the strong glass variant. |

### Glass Surfaces

The video-feed overlays (action rail, seller pill, price card, chips, top bar) sit on top of moving imagery. Solid surfaces fight for attention with the video; pure-transparent surfaces lose legibility. Glass — a translucent dark wash with a thin border — is the resolution.

**iOS** uses `expo-blur`'s `BlurView` with `tint="dark"` and an intensity from `theme.blur.intensity` (`subtle | regular | strong`). The blur is the surface; the `colors.glass.*.bg` value is **not** painted on iOS.

**Android** falls back to a solid `View` painted with `colors.glass.*.bg`. Native blur on Android is unreliable across vendors and OS versions, so we don't try. The solid tint approximates the visual at far less risk.

**Variants**
- `glass.dark` — default. Light surfaces over busy video.
- `glass.darkStrong` — when contrast is critical (price card on bright media, sheet headers).

**Always pair glass with the matching border token** (`colors.glass.<variant>.border`). The hairline border is what gives the surface an edge against bright video. Glass without a border looks like a smudge.

**Do not** stack two glass surfaces. Two layers of blur produces a grey mush. If you need depth, use `surface` or `surfaceElevated` underneath and glass on top.

### Status Tokens

`colors.verified` (`#3B82F6`) and `colors.proBadge` (`#8B5CF6`) are status accents, not brand colors. They mark trust signals on accounts and are intentionally distinct from the coral brand so they don't compete with conversion surfaces.

- **`verified`** is a small filled circle with a white check, overlaid bottom-right on an avatar or trailing the seller's name. Reserved for accounts that have completed identity verification. Do not use it as a generic "this is good" indicator.
- **`proBadge`** is a small pill or chip background marking a professional / business seller. Pair its background with `colors.proBadgeText` (white) for the label text. Do not invent other "premium" or "boutique" badges in this color.

Both tokens are sparse-use. If a screen has more than one verified or PRO badge competing for attention, the screen is wrong, not the tokens.

---

## Typography

Two families, both Google Fonts, both loaded at app boot with `expo-font`.

- **Inter** — sans-serif. The default for everything: body, titles, captions, labels, inputs.
- **Fraunces** — serif display. Reserved for the `display` variant on hero moments (splash mark, large numerics on conversion surfaces, occasional editorial accents). Do not use for body or repeating UI text.

When in doubt, use Inter. Fraunces is for moments, not for layout.

**Loaded weights**
- Inter: 400, 500, 600, 700
- Fraunces: 400, 500, 600

**Weight tokens** (`typography.weight`)
- `regular` → 400
- `medium` → 500
- `semibold` → 600
- `bold` → 700

**Size scale** (`typography.size`, in points)

| Token | Size | Typical use |
| --- | --- | --- |
| `xs` | 11 | Labels, micro-meta |
| `sm` | 13 | Captions, helper text |
| `md` | 15 | Body — default |
| `lg` | 17 | Emphasised body, CTA labels |
| `xl` | 20 | Section titles |
| `xxl` | 24 | Screen titles |
| `xxxl` | 32 | Hero numerics |
| `hero` | 44 | Splash / display moments |

**Line height multipliers** (`typography.lineHeight`)
- `tight` 1.15 — display
- `snug` 1.3 — titles
- `normal` 1.45 — body
- `relaxed` 1.6 — long-form copy

**Letter-spacing** (`typography.tracking`, in points)
- `tight` -0.4 — large display
- `normal` 0
- `wide` 0.4
- `ultraWide` 1.2 — uppercase labels

**Variants** (resolved by the `Text` primitive)

| Variant | Family | Weight | Size | Line height | Notes |
| --- | --- | --- | --- | --- | --- |
| `display` | Fraunces | 500 | `hero` | `tight` | Hero moments only. |
| `title` | Inter | 600 | `xl` | `snug` | Section / screen titles. |
| `body` | Inter | 400 | `md` | `normal` | Default. |
| `caption` | Inter | 400 | `sm` | `normal` | `colors.text.secondary` by default. |
| `label` | Inter | 600 | `xs` | `normal` | Uppercase, `tracking.ultraWide`. |

---

## Spacing & Radii

**Spacing scale** (`spacing`, in points). Stick to the scale. If a layout needs a value not in the scale, the layout is wrong, not the scale.

| Token | Value |
| --- | --- |
| `0` | 0 |
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 24 |
| `xxxl` | 32 |
| `huge` | 48 |

**Radii** (`radii`, in points). Match the geometry rules above.

| Token | Value | Typical use |
| --- | --- | --- |
| `none` | 0 | — |
| `xs` | 4 | Inputs |
| `sm` | 8 | Tight chips |
| `md` | 12 | Small cards |
| `lg` | 16 | Cards, list items |
| `xl` | 20 | Sheets, large cards |
| `xxl` | 28 | Hero surfaces |
| `pill` | 999 | Chips, primary CTAs, segmented controls |

---

## Elevation & Surfaces

The dark stack is the elevation system. There are three layers.

| Layer | Token | Purpose |
| --- | --- | --- |
| Base | `colors.background` (`#000`) | App background. Behind everything. |
| Surface | `colors.surface` (`#0A0A0A`) | One step up — cards, sheets, list rows over background. |
| Surface elevated | `colors.surfaceElevated` (`#161616`) | Two steps up — input fields, popovers, sheets stacked over surface. |

Borders carry the rest of the elevation signal:
- `elevation.surface.borderColor` → `colors.border`
- `elevation.surfaceElevated.borderColor` → `colors.borderStrong`

We do not use shadow elevation on dark surfaces — shadows do not read on black. Use the surface stack and borders.

Glass surfaces (introduced in Step 3) layer on top of media using `expo-blur`. The intensity tokens live under `blur.intensity` and the tint is locked to `dark`.

---

## Iconography

Placeholder. Icon system to be defined in a later step. For now, continue using `@expo/vector-icons` (`Ionicons`, `MaterialIcons`) wherever the audit shows them already in use. Do not introduce a new icon set in Step 2.

---

## Voice

Placeholder. Voice and copy guidelines to be defined in a later step. For now, write UI copy that is direct, mobile-native, and free of marketing throat-clearing. Buyers and sellers, not "users." Listings, not "items." If a button can say "Buy" instead of "Purchase now," it does.
