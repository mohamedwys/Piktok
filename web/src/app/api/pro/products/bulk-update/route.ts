import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro: bulk-update products (Track 3).
 *
 * Accepts `{ ids: string[], patch: { purchase_mode } }` and fans out N
 * parallel `update().eq('id', $id).eq('seller_id', $mySellerId)`
 * statements. Atomic per row: a failure on one id does not prevent
 * others from succeeding. The response always returns 200 with a
 * `{ updated, failed }` shape so the client can render partial-success
 * UX without parsing a per-row error envelope.
 *
 * Defense in depth:
 *   - `requireProApi()` gates the entire route; unauthenticated /
 *     non-Pro callers never reach the update fan-out.
 *   - Each update narrows by both `id` AND `seller_id = gate.sellerId`,
 *     so even if a caller forges a product id belonging to a different
 *     seller, the eq() filter (combined with RLS) yields zero matched
 *     rows.
 *   - The `enforce_purchase_mode_pro_only_trg` trigger on `products`
 *     is the last line of defense — a non-Pro caller would have been
 *     blocked by `requireProApi`, but a future Pro-status race could
 *     still see the trigger silently downgrade 'buy_now' to
 *     'contact_only'. We accept that — it matches the table's
 *     trigger-enforced invariant.
 *
 * Body validation: the request body must be a JSON object with
 *   - `ids`: an array of 1..200 strings (cap prevents accidental
 *     unbounded fan-outs and matches our typical "select all" sizes).
 *   - `patch.purchase_mode`: 'buy_now' | 'contact_only'.
 * Anything else returns 400. We do NOT accept other patch fields in
 * the bulk route — the single-product editor handles arbitrary
 * patches; bulk is purpose-built for the purchase_mode toggle.
 */
const MAX_BULK_IDS = 200;

type BulkBody = {
  ids: string[];
  patch: { purchase_mode: 'buy_now' | 'contact_only' };
};

function validateBody(raw: unknown): BulkBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const ids = obj.ids;
  const patch = obj.patch;
  if (!Array.isArray(ids)) return null;
  if (ids.length < 1 || ids.length > MAX_BULK_IDS) return null;
  if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
    return null;
  }
  if (typeof patch !== 'object' || patch === null) return null;
  const patchObj = patch as Record<string, unknown>;
  const mode = patchObj.purchase_mode;
  if (mode !== 'buy_now' && mode !== 'contact_only') return null;
  return {
    ids: ids as string[],
    patch: { purchase_mode: mode },
  };
}

export async function POST(req: Request) {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const body = validateBody(raw);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  // Connect gate for buy_now: even though `enforce_purchase_mode_pro_only_trg`
  // checks `is_pro`, it does NOT inspect Connect state. A Pro seller without
  // an active Stripe Connect account can still trigger the column write but
  // checkout would 403 (`pro_not_connected`) at the edge function. Refuse
  // the patch here so the seller is told to finish Connect before flipping
  // listings to Buy Now. Disabling Buy Now (back to contact_only) is always
  // allowed.
  if (body.patch.purchase_mode === 'buy_now') {
    const { data: seller } = await supabase
      .from('sellers')
      .select('stripe_charges_enabled')
      .eq('id', gate.sellerId)
      .maybeSingle();
    if (seller?.stripe_charges_enabled !== true) {
      return NextResponse.json(
        { error: 'pro_not_connected' },
        { status: 400 },
      );
    }
  }

  const results = await Promise.allSettled(
    body.ids.map((id) =>
      supabase
        .from('products')
        .update(body.patch)
        .eq('id', id)
        .eq('seller_id', gate.sellerId)
        .select('id')
        .maybeSingle()
        .then((res) => {
          if (res.error) {
            return { ok: false as const, id, error: res.error.message };
          }
          if (!res.data) {
            return { ok: false as const, id, error: 'not_found' };
          }
          return { ok: true as const, id };
        }),
    ),
  );

  const updated: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const id = body.ids[i];
    if (r.status === 'fulfilled') {
      if (r.value.ok) updated.push(r.value.id);
      else failed.push({ id: r.value.id, error: r.value.error });
    } else {
      const message =
        r.reason instanceof Error ? r.reason.message : 'unknown';
      failed.push({ id, error: message });
    }
  }

  console.log(
    `[pro/products] bulk-update seller=${gate.sellerId} ` +
      `updated=${updated.length} failed=${failed.length} ` +
      `mode=${body.patch.purchase_mode}`,
  );

  return NextResponse.json({ updated: updated.length, failed });
}
