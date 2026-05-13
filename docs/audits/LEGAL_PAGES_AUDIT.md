# Legal Pages Audit

_Phase H.15 — Privacy / Terms / Child Safety pages_
_Started: 2026-05-05_

## Architecture decisions

### Markdown + react-markdown (vs alternatives)
- **Chosen:** plain markdown files per locale, rendered via `react-markdown` + `remark-gfm`  
- **Why:** legal text is too long for `messages/*.json`, too static to need a CMS.  
  Markdown lets a non-developer edit copy without touching JSX.  
  `react-markdown` is the minimal-footprint option that handles GFM tables (needed for the GDPR basis table in Privacy).
- **Alternatives considered:** MDX (overkill — no interactive components needed), Sanity (overkill — no editorial workflow needed), inline JSX strings (unmaintainable).

### Deviations from prompt

| # | Prompt instruction | Actual implementation | Reason |
|---|---|---|---|
| 1 | Add a separate `LegalNav` component to the footer | Updated the existing `Footer.tsx` legal column instead — it already exists with Terms/Privacy/Cookies placeholder links | Avoids duplicating a legal nav that already exists; cleaner single source of truth |
| 2 | Add `dir` to `[locale]/layout.tsx` | No change needed — root `web/src/app/layout.tsx` already sets `<html dir="rtl"\|"ltr">` via a `RTL_LOCALES` check (added in H.7.2) | Deviation from prompt is correct; root layout is authoritative |
| 3 | Footer uses `<a>` for links | Legal column links changed to use `Link` from `@/i18n/routing` for locale-aware navigation; other columns remain `<a>` | Locale-aware Link is necessary for `/legal/*` paths to work correctly across all locales |
| 4 | Replace `linkCookies` in legal column | `linkCookies` key kept in messages (for future), replaced in footer column by `linkChildSafety` | Child Safety is a hard requirement for app store; Cookies page does not yet exist |
| 5 | `generateStaticParams` for legal pages | Pages rely on the parent `[locale]/layout.tsx` which already exports `generateStaticParams` returning all locales | Next.js inherits static params from ancestor layouts; no duplication needed |

### Footer column change (linkCookies → linkChildSafety)
The existing footer Legal column had `linkCookies` pointing to `#`. Since there is no cookies policy page yet and Child Safety is a hard App Store / Play Store requirement, `linkChildSafety` replaces the cookies slot in the Legal column. The `linkCookies` key remains in all `messages/*.json` files for future use.

## Files created

- `web/src/content/legal/privacy.en.md`
- `web/src/content/legal/privacy.fr.md`
- `web/src/content/legal/privacy.ar.md`
- `web/src/content/legal/terms.en.md`
- `web/src/content/legal/terms.fr.md`
- `web/src/content/legal/terms.ar.md`
- `web/src/content/legal/child-safety.en.md`
- `web/src/content/legal/child-safety.fr.md`
- `web/src/content/legal/child-safety.ar.md`
- `web/src/app/[locale]/legal/layout.tsx`
- `web/src/app/[locale]/legal/privacy/page.tsx`
- `web/src/app/[locale]/legal/terms/page.tsx`
- `web/src/app/[locale]/legal/child-safety/page.tsx`
- `web/src/app/sitemap.ts`
- `web/public/robots.txt`

## Files modified

- `web/src/app/globals.css` — added `.legal-prose` styles
- `web/messages/en.json` — added `legal` namespace
- `web/messages/fr.json` — added `legal` namespace
- `web/messages/ar.json` — added `legal` namespace (AR note: DRAFT, pending native-speaker review)
- `web/src/components/landing/Footer.tsx` — legal column: real hrefs, Link from next-intl, child-safety link
- `src/app/(protected)/(tabs)/profile.tsx` — added Legal section with WebBrowser rows
- `src/i18n/locales/en.json` — added `settings.legal.*` keys
- `src/i18n/locales/fr.json` — added `settings.legal.*` keys

## Open handoffs (required before UAE public launch)

1. **Legal entity name** — fill `[LEGAL ENTITY NAME]` in all 6 EN + FR markdown files
2. **Registered address** — fill `[REGISTERED ADDRESS]` in privacy.en.md + privacy.fr.md
3. **UAE license number** — fill `[LICENSE NUMBER]` in privacy.en.md + privacy.fr.md
4. **Effective dates** — fill `[DATE]` placeholders in all 6 EN + FR files
5. **AR translations** — commission a professional Arabic legal translator for all 3 AR stubs before UAE public launch
6. **Lawyer review** — EN + FR content has not been reviewed by a UAE-licensed attorney; do not publish as final policy without legal sign-off
7. **Cookies page** — `linkCookies` key is in messages but no page exists yet; build `/legal/cookies` before using the key in the footer
8. **NCMEC registration** — confirm whether the app needs to register as an electronic service provider with NCMEC for mandatory reporting obligations
