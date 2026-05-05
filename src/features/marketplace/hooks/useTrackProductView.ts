import { useEffect, useRef } from 'react';
import { trackProductView } from '@/features/marketplace/services/analytics';

/**
 * Phase H.13 — fire one product-view event per product per app session.
 *
 * Mounted unconditionally by `ProductDetailSheet`. The hook is purely
 * side-effecting; it returns nothing.
 *
 * Dedup: a `useRef<Set<string>>` records every productId we have already
 * tracked in this app session. A double-mount of the sheet (React strict
 * mode, or fast open/close/reopen of the same listing) does not double
 * count. Closing the app and reopening produces a fresh ref → the same
 * product re-tracks once on next open. This is the desired naïve "session
 * = unique" semantics for v1.
 *
 * Owner self-views are NOT filtered here — that is the
 * `track_product_view` RPC's job (server-side, can't be bypassed by a
 * compromised client). See ANALYTICS_AUDIT.md §2.9.
 *
 * Errors are silently dropped by the underlying service helper. The hook
 * never throws or surfaces an error to the consumer.
 */
export function useTrackProductView(productId: string | null | undefined): void {
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!productId) return;
    if (fired.current.has(productId)) return;
    fired.current.add(productId);
    void trackProductView(productId);
  }, [productId]);
}
