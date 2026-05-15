import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Mony web — Next.js configuration.
 *
 * Kept intentionally minimal. The H.6 scaffold relies on Next.js
 * defaults for App Router, Image optimization, and turbopack-on-dev.
 * Future configuration (e.g., remote image domains for Supabase
 * Storage, redirect rules) lands here as the surface grows.
 *
 * `outputFileTracingRoot` pins this build to /web. The repo also
 * has a root-level package-lock.json (the Expo mobile app's), and
 * without this hint Next.js warns about ambiguity when discovering
 * which files belong to the build trace. The web build only needs
 * /web's own dependency graph.
 *
 * The `next-intl` plugin (H.7.1) wires the per-request config at
 * `src/i18n/request.ts` into the build pipeline. Wraps the entire
 * Next config so locale-aware Server Components resolve their
 * message catalogs through the plugin.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  /**
   * PostHog reverse-proxy rewrites.
   *
   * Routes browser-side PostHog requests through the app's own origin
   * (`/ingest/*` on mony-psi.vercel.app) so ad blockers can't bucket
   * them under their third-party-tracker rules. Without the proxy,
   * roughly 20–40% of users (per industry estimates) drop their
   * PostHog calls and the analytics under-count accordingly.
   *
   * Rewrites are evaluated by Vercel's edge layer — no Node round-trip
   * on the hot path — and in `next dev` by the Next.js dev server, so
   * the same `api_host: '/ingest'` works in both environments.
   *
   * Three rewrites in order (Next.js matches top-to-bottom):
   *   - /ingest/static/* → eu-assets.i.posthog.com (the SDK + recorder
   *     assets live on a separate CDN host).
   *   - /ingest/decide   → eu.i.posthog.com/decide (feature flag fetch).
   *   - /ingest/*        → eu.i.posthog.com/* (catch-all for capture
   *     and everything else).
   *
   * `skipTrailingSlashRedirect: true` is required because PostHog's
   * /capture/ endpoint has a trailing slash that Next.js would
   * otherwise 308-redirect away — the redirect breaks the SDK's
   * keepalive flush, dropping the last events on tab close.
   *
   * Server-side flag fetches in lib/posthog.ts keep hitting
   * https://eu.i.posthog.com directly because they run on the Vercel
   * server, where ad blockers don't apply. Only the browser path
   * benefits from the proxy.
   */
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://eu.i.posthog.com/decide',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
