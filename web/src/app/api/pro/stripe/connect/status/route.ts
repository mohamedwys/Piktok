import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSellerConnectState } from '@/lib/pro/data';

/**
 * Pro: poll the seller's Stripe Connect status (Track F.C.2).
 *
 * Lightweight read used by `/pro/payouts/return` to wait for the
 * `account.updated` webhook to flip `charges_enabled = true`. The
 * payload is a tight subset of `SellerConnectState` — just the bits
 * the polling client needs to decide between the polling, success,
 * and timeout sub-states. We deliberately do NOT return the
 * stripe_account_id or country here; both are dashboard-render
 * concerns, and the polling endpoint should be the smallest possible
 * surface.
 *
 * Gated by `requireProApi` (NOT `requireProConnectedApi`) — the
 * polling caller is in the not-yet-connected state by definition.
 * Same reasoning as `/api/pro/subscription-status`: gating on the
 * very state we're observing would lock the polling page out of
 * its own check.
 *
 * Cache-Control: no-store. Polling endpoints must observe live
 * state transitions; a cache hit would stretch the polling window.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  const supabase = await getSupabaseServer();
  const state = await fetchSellerConnectState(supabase, gate.sellerId);

  return NextResponse.json(
    {
      status: state.status,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
