import path from 'node:path';
import type { NextConfig } from 'next';

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
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
