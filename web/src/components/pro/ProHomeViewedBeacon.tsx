'use client';

import { useEffect } from 'react';
import { captureEvent } from '@/lib/posthog-client';

/**
 * Fires a single PostHog `pro_home_viewed` event when the Pro home
 * page mounts. Tiny Client Component because the PostHog client
 * surface isn't safe to call from a Server Component (no `window`,
 * no client cookies, no in-flight POST). Mounting it at the bottom
 * of the page means it runs after the dashboard surface has
 * hydrated — the event reflects a successful render, not a
 * server-side near-miss.
 *
 * `userId` is the authenticated user's UUID, threaded from the
 * Server Component via `requirePro()`. Forwarded as PostHog
 * `distinct_id` so the capture correlates to the user instead of
 * the anonymous bucket.
 *
 * The `useEffect` empty-deps array means we fire ONCE per mount.
 * Next.js client navigations remount this component when the user
 * leaves and comes back to /pro, which is the desired cadence — one
 * view per dashboard visit.
 */
export function ProHomeViewedBeacon({ userId }: { userId: string }) {
  useEffect(() => {
    captureEvent('pro_home_viewed', {}, userId);
  }, [userId]);

  return null;
}
