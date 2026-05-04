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
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
