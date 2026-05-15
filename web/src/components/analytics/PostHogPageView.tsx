'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';

/**
 * Fires a PostHog `$pageview` event on every client-side route
 * transition.
 *
 * Required because the SDK's built-in `capture_pageview` only watches
 * full document loads + `popstate` — Next.js App Router pushes new
 * URLs via `history.pushState` for in-app navigation, which the SDK
 * doesn't observe. So we initialize the SDK with
 * `capture_pageview: false` (in `PostHogProvider`) and emit pageviews
 * here, keyed off `usePathname()` + `useSearchParams()`.
 *
 * Render-tree placement: must live inside `PostHogProvider` so
 * `usePostHog()` resolves the client instance. The caller is
 * responsible for wrapping this component in `<Suspense fallback={null}>`
 * because `useSearchParams()` triggers Next.js's CSR-bailout otherwise
 * (every static / ISR route under the tree would deopt to fully
 * dynamic rendering).
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${pathname}${qs ? `?${qs}` : ''}`
        : `${pathname}${qs ? `?${qs}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
