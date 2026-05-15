'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';

/**
 * Client-side PostHog SDK provider.
 *
 * Initializes `posthog-js` once on first mount and exposes the
 * `posthog` instance via React context (`usePostHog()` etc.) for
 * any descendant Client Component. Mounted at the root layout so
 * every route — locale-prefixed and outside-the-locale-tree alike
 * (e.g. `/auth/callback`) — gets the SDK.
 *
 * SDK config rationale:
 *
 *   - `capture_pageview: false` + manual fire in `PostHogPageView`.
 *     Next.js App Router navigations are client-side and don't trigger
 *     the SDK's default `$pageview` autocapture (which listens on
 *     `popstate` / full document loads only). We push `$pageview`
 *     manually on every pathname / searchParams change instead.
 *
 *   - `capture_pageleave: true`. The SDK's default behavior is
 *     `'if_capture_pageview'`, which silently turns pageleave off
 *     when `capture_pageview` is false. We need it on explicitly so
 *     PostHog can compute bounce rate, session duration, and scroll
 *     depth (the latter rides on the pageleave payload as
 *     `$prev_pageview_max_scroll_percentage`).
 *
 *   - `capture_performance: { web_vitals: true }`. Enables LCP / INP /
 *     CLS reporting via the `$web_vitals` event. Off by default in
 *     posthog-js; PostHog's Web Vitals dashboard depends on it.
 *
 *   - `person_profiles: 'identified_only'`. We only want PostHog Person
 *     profiles to exist for authenticated users (already covered by the
 *     existing `captureEvent(..., userId)` pattern in
 *     `posthog-client.ts` and by `posthog.identify()` once we wire that
 *     on auth-callback). Anonymous events still flow but don't create
 *     person rows — keeps the event volume reasonable.
 *
 * Falls back to a no-op render when the env vars are unset (local
 * dev without PostHog wired up). Mirrors the silent fallback in
 * `lib/posthog.ts` and `lib/posthog-client.ts` — telemetry should
 * never break the user-facing surface.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!apiKey || !host) return;

    // posthog-js guards against double-init internally, but check the
    // `__loaded` flag as well so HMR remounts don't trigger a warning.
    if (typeof window !== 'undefined' && !posthog.__loaded) {
      posthog.init(apiKey, {
        // Reverse-proxy via Next.js rewrites (see next.config.ts).
        // Browser-side requests go to /ingest/* on our own origin and
        // are forwarded to PostHog server-side. `ui_host` keeps the
        // PostHog toolbar's "open in PostHog" links pointing at the
        // real dashboard, not at our proxy origin (which would 404).
        api_host: '/ingest',
        ui_host: 'https://eu.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
        capture_performance: { web_vitals: true },
        // Heatmaps autocapture — captures scroll position + click
        // heatmap data continuously. The PostHog Web Analytics Health
        // page's "scroll depth" check looks for events carrying scroll
        // properties; this flag enables them. `host` is still required
        // to fall through to the same env-gated no-op fallback.
        enable_heatmaps: true,
        person_profiles: 'identified_only',
      });
    }
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
