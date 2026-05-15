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
 * Why `capture_pageview: false`:
 *   Next.js App Router navigations are client-side and don't trigger
 *   the SDK's default `$pageview` autocapture (which listens on
 *   `popstate` / full document loads only). `PostHogPageView` fires
 *   `$pageview` manually on every pathname / searchParams change so
 *   route transitions surface in PostHog.
 *
 * Why `person_profiles: 'identified_only'`:
 *   We only want PostHog Person profiles to exist for authenticated
 *   users (already covered by the existing `captureEvent(..., userId)`
 *   pattern in `posthog-client.ts` and by `posthog.identify()` once
 *   we wire that on auth-callback). Anonymous events still flow but
 *   don't create person rows — keeps the event volume reasonable.
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
        api_host: host,
        capture_pageview: false,
        person_profiles: 'identified_only',
      });
    }
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
