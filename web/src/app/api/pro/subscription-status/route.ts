import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Lightweight "is the caller Pro yet?" probe — used exclusively by
 * `/upgrade/success` to poll for Stripe webhook activation (Track 7).
 *
 * **Why not gate on `requireProApi`.** That helper 403s non-Pro
 * callers, which is exactly the state we're polling FROM. Using it
 * would lock the success page out of its own activation check until
 * the very moment we no longer need it. Instead we gate on
 * `requireUser` (signed-in + has a seller row) and read `is_pro`
 * directly.
 *
 * **Source of truth.** Reads `sellers.is_pro`, the trigger-maintained
 * boolean that's the same gate every other Pro surface checks. The
 * `subscriptions.status` row arrives FIRST (webhook upsert), the
 * `handle_subscription_change` trigger flips `is_pro` SECOND. Reading
 * `is_pro` instead of joining `subscriptions.status='active'` keeps
 * the polling loop symmetric with the rest of the platform — when
 * other surfaces start showing Pro features, this endpoint reports
 * `active: true`.
 *
 * **No-store.** Polling endpoints must never be cached. The whole
 * point is to observe a state transition; a 304 / cache hit would
 * stretch the polling window forever.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('sellers')
    .select('is_pro')
    .eq('id', gate.sellerId)
    .maybeSingle();

  if (error) {
    console.error(
      `[pro/subscription-status] read failed seller=${gate.sellerId}: ${error.message}`,
    );
    return NextResponse.json(
      { error: 'read_failed', details: error.message },
      { status: 500 },
    );
  }

  const active = data?.is_pro === true;
  return NextResponse.json(
    { active },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
