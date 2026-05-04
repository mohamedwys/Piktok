import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for use in Client Components.
 *
 * Reads the same cookies the server client writes — `@supabase/ssr`
 * keeps the two halves in sync transparently. Returned fresh per
 * call (rather than a module-level singleton) so different React
 * Components can hold their own client without sharing internal
 * state across renders. The underlying fetch and cookie I/O are
 * cheap; allocation is not the bottleneck.
 *
 * Use this only inside `'use client'` files. For Server Components,
 * Route Handlers, and Server Actions, use `getSupabaseServer` from
 * `./server` instead.
 *
 * H.6 ships only auth-gated server pages (no client mutations
 * yet), so this client is a forward-provision for H.7+ surfaces
 * (e.g., the Stripe Checkout-redirecting "Subscribe" button on
 * /upgrade is a Client Component).
 */
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
