import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase admin client (H.9).
 *
 * Bypasses Row-Level Security. Use ONLY from server-side code
 * paths that need to perform privileged writes — currently the
 * Stripe webhook handler at `/api/stripe/webhook/route.ts`,
 * which writes to `public.subscriptions` (RLS only allows the
 * service role to insert/update per the H.2 schema).
 *
 * **Critical security boundary:**
 *   - `SUPABASE_SERVICE_ROLE_KEY` MUST stay server-side. It
 *     bypasses every RLS policy and can read/write any row.
 *   - NEVER prefix the env var with `NEXT_PUBLIC_` — that
 *     would inline it into the client bundle.
 *   - NEVER import `getSupabaseAdmin` from a Client Component
 *     ('use client' file) or pass its return value to one.
 *     Next.js's bundler will surface a build error if the
 *     symbol leaks across the boundary, but defense-in-depth:
 *     keep it under `lib/supabase/` and only consume it from
 *     route handlers / Server Actions that explicitly need
 *     RLS bypass.
 *
 * Module-level singleton — created once per server-runtime
 * instance, reused across requests. Re-creating per webhook
 * would waste the underlying fetch agent's connection
 * pooling. The cache is per-Node-worker on Vercel; spinning
 * up a new function instance gets a fresh client.
 *
 * `auth: { autoRefreshToken: false, persistSession: false }`:
 * service-role keys don't expire (no refresh needed) and we
 * don't want any session state — every call is one-shot.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      '[H.9] NEXT_PUBLIC_SUPABASE_URL is not set. Add it to ' +
        '.env.local (and Vercel project env vars).',
    );
  }
  if (!key) {
    throw new Error(
      '[H.9] SUPABASE_SERVICE_ROLE_KEY is not set. Get it from ' +
        'Supabase Dashboard → Project Settings → API → ' +
        '"service_role" (server-only — NEVER prefix with ' +
        'NEXT_PUBLIC_).',
    );
  }

  cached = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
