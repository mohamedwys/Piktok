import type { NextConfig } from 'next';

/**
 * Mony web — Next.js configuration.
 *
 * Kept intentionally minimal. The H.6 scaffold relies on Next.js
 * defaults for App Router, Image optimization, and turbopack-on-dev.
 * Future configuration (e.g., remote image domains for Supabase
 * Storage, redirect rules) lands here as the surface grows.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
