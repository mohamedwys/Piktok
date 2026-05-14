/**
 * Server-side PostHog feature flag fetcher (Track 1).
 *
 * Env-var contract — IMPORTANT, the two platforms differ:
 *   - WEB (Next.js, this file) reads `NEXT_PUBLIC_POSTHOG_KEY` and
 *     `NEXT_PUBLIC_POSTHOG_HOST` (canonical Next.js prefix).
 *   - MOBILE (Expo, src/lib/posthog.ts) reads
 *     `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`
 *     (canonical Expo prefix).
 * Both name pairs hold the SAME values — the same PostHog project
 * (Mony EU). The two namespaces exist because each framework has
 * its own client-bundle prefix discipline.
 *
 * Why no `posthog-node` dependency? The Track 1 brief forbids
 * adding new web dependencies. PostHog's `/decide?v=3` HTTP
 * endpoint is the same surface their server SDK ultimately calls,
 * so we hit it directly with `fetch`. If a later track needs the
 * richer flag-payload features (variant overrides, group
 * properties, bootstrap), this fetcher should be replaced with the
 * official `posthog-node` SDK.
 *
 * Endpoint: `POST {host}/decide?v=3` with a JSON body containing
 * `api_key` and `distinct_id`. The response includes a
 * `featureFlags` map keyed by flag name. For boolean flags the
 * value is `true | false`; for multivariate flags it's the variant
 * string — we only support boolean here.
 *
 * Caching: this runs in a Server Component invoked per request
 * (force-dynamic Pro pages). Next.js's `fetch` cache is left at
 * the default for this call so an upstream override cannot pin a
 * stale flag value across revalidations. PostHog quotas comfortably
 * cover per-request flag reads at our traffic level; if the volume
 * grows, switch to a 60s memoize at the route boundary rather than
 * caching here (cache invalidation on flag flips would otherwise
 * delay the rollout/kill switch).
 */

const DECIDE_PATH = '/decide?v=3';

type DecideResponse = {
  featureFlags?: Record<string, boolean | string>;
};

/**
 * Read a boolean feature flag from PostHog. Returns `fallback` when
 * the env vars are unset (local dev without PostHog wired up), when
 * the network request fails, when the response is non-200, when the
 * key is absent, or when the value isn't a boolean.
 *
 * `distinctId` should be the authenticated user's UUID when
 * available — pass `userId` from `requirePro()`. When omitted, an
 * anonymous bucket id is used so PostHog can still evaluate global
 * rollouts; per-user flag overrides won't apply in that case.
 */
export async function getFeatureFlag(
  name: string,
  fallback: boolean,
  distinctId?: string,
): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) {
    // Local-dev case: PostHog not configured. Silent fallback —
    // logging here would spam the dev console on every request.
    return fallback;
  }

  try {
    const response = await fetch(`${host.replace(/\/$/, '')}${DECIDE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId ?? `anon-${name}`,
      }),
    });

    if (!response.ok) {
      console.warn(
        `[posthog] flag '${name}' fetch failed: ${response.status}`,
      );
      return fallback;
    }

    const data = (await response.json()) as DecideResponse;
    const value = data.featureFlags?.[name];
    if (typeof value === 'boolean') {
      return value;
    }
    return fallback;
  } catch (err) {
    console.warn(
      `[posthog] flag '${name}' fetch errored:`,
      err instanceof Error ? err.message : String(err),
    );
    return fallback;
  }
}
