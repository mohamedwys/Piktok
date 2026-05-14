'use client';

/**
 * Client-side PostHog `capture` for the web companion (Track 2).
 *
 * No `posthog-js` SDK dependency. The Track 1 brief forbids new web
 * deps, and PostHog's `/capture/` endpoint is a single POST that the
 * browser can hit directly with `fetch`. Same shape rationale as
 * `web/src/lib/posthog.ts` (server-side `getFeatureFlag`): if the
 * surface grows (autocapture, session replay, etc.) this should be
 * swapped for the official SDK.
 *
 * Env vars: `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` —
 * the same NEXT_PUBLIC_-prefixed pair the server helper reads, so the
 * client can read them at runtime.
 *
 * Fire-and-forget: errors are swallowed because telemetry must never
 * break the user-facing surface. A failed capture is a missed metric,
 * not a missed render.
 *
 * Distinct id discipline: PostHog identifies events by `distinct_id`.
 * For Pro-dashboard telemetry we have the authenticated user's UUID
 * at the call site (Server Component → passes it down to the beacon
 * → beacon forwards it here). If `distinctId` is omitted we use an
 * `anon-pro` bucket so global pro-funnel rollouts can still see the
 * event without correlating to a user.
 */
export function captureEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId?: string,
): void {
  if (typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return;

  const url = `${host.replace(/\/$/, '')}/capture/`;
  const body = JSON.stringify({
    api_key: apiKey,
    event,
    distinct_id: distinctId ?? 'anon-pro',
    properties: {
      ...properties,
      $current_url: window.location.href,
    },
  });

  // Use `keepalive` so the request survives a navigation away from
  // the current page (the user clicks a dashboard link the moment
  // the page paints — without keepalive the in-flight capture would
  // be cancelled).
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Telemetry failure is non-fatal. Don't log to console either —
    // a flapping endpoint would otherwise spam every dashboard view.
  });
}
