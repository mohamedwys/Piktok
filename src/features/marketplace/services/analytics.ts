import { supabase } from '@/lib/supabase';

/**
 * Phase H.13 — service-layer wrappers around the two SECURITY DEFINER RPCs
 * defined in supabase/migrations/20260605_product_views.sql:
 *
 *   - `track_product_view(p_product_id)`  → fire-and-forget view event
 *   - `get_product_analytics(p_product_id)` → owner-only aggregate read
 *
 * Both calls use a `as never` cast on the RPC name + args until
 * `npm run gen:types` registers the new functions in
 * `Database['public']['Functions']`. Same documented escape pattern as
 * E.2's `incrementShareCount` and H.12's `featureProduct`.
 *
 * See ANALYTICS_AUDIT.md for the full design rationale (silent error
 * handling on track, ownership gating on read, owner-self-view exclusion
 * in the RPC body, etc.).
 */

export type ProductAnalytics = {
  views_24h: number;
  views_7d: number;
  views_30d: number;
};

/**
 * Records one product-view event. Owner self-views are filtered server-side
 * by the SECURITY DEFINER RPC, so callers do NOT need to pre-check
 * ownership. Anonymous (unauthenticated) callers are valid — the RPC is
 * granted to both `anon` and `authenticated`.
 *
 * Errors are NOT thrown by this helper — view-tracking failure must never
 * surface to the user. The function returns `void` regardless of outcome.
 * Network / RLS / RPC-not-yet-deployed errors are silently swallowed.
 */
export async function trackProductView(productId: string): Promise<void> {
  try {
    await supabase.rpc(
      'track_product_view' as never,
      { p_product_id: productId } as never,
    );
  } catch {
    // Silent — see jsdoc + ANALYTICS_AUDIT.md §2.11.
  }
}

/**
 * Fetches the (24h / 7d / 30d) view counts for a product owned by the
 * caller. The RPC raises `not_authorized` if the caller is not the owner;
 * this helper re-throws so React Query can transition to `isError`.
 *
 * Pro state is NOT checked server-side; the analytics surfaces are
 * client-gated by `useIsPro`. Cf. ANALYTICS_AUDIT.md §2.8.
 */
export async function getProductAnalytics(
  productId: string,
): Promise<ProductAnalytics> {
  const { data, error } = await supabase.rpc(
    'get_product_analytics' as never,
    { p_product_id: productId } as never,
  );
  if (error) throw error;
  // The RPC returns a single-row table. PostgREST surfaces it as a
  // one-element array. Defensive zero-fallback covers the (impossible
  // in practice) empty-array case so the consuming UI never crashes
  // on undefined.
  const row = (data as unknown as ProductAnalytics[] | null)?.[0];
  return (
    row ?? {
      views_24h: 0,
      views_7d: 0,
      views_30d: 0,
    }
  );
}
