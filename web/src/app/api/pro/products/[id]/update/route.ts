import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro: single product update (Track 3).
 *
 * Accepts `{ patch }` where `patch` is an object containing any subset
 * of the user-controlled product columns. Unknown keys are stripped
 * before the database touch so a forged payload cannot probe the
 * column-level GRANT surface or attempt to write counter columns.
 *
 * Whitelist matches the column-level grant established in
 * 20260519_tighten_products_update_grants.sql, plus `purchase_mode`
 * (added in 20260712 with its own Pro-only enforcement trigger). The
 * trigger silently downgrades non-Pro callers to 'contact_only'; this
 * route gates by `requireProApi` so non-Pro callers are blocked before
 * the trigger ever sees their write.
 *
 * `select().maybeSingle()` returns NULL when no row matched (RLS
 * blocked or wrong owner), which we surface as 404. Defense in depth:
 * the explicit `eq('seller_id', gate.sellerId)` makes the wrong-owner
 * case crisp even before RLS.
 */
const ALLOWED_KEYS = new Set([
  'title',
  'description',
  'price',
  'currency',
  'stock_available',
  'stock_label',
  'shipping_free',
  'shipping_label',
  'pickup_available',
  'location',
  'purchase_mode',
  'media_url',
  'thumbnail_url',
  'dimensions',
  'attributes',
  'category',
  'category_id',
  'subcategory_id',
]);

function sanitizePatch(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (ALLOWED_KEYS.has(key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof raw !== 'object' || raw === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const rawPatch = (raw as Record<string, unknown>).patch;
  const patch = sanitizePatch(rawPatch);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'empty_patch' },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServer();

  // Connect gate for buy_now: matches the bulk-update route. The trigger
  // `enforce_purchase_mode_pro_only_trg` checks `is_pro` only and would
  // let a Pro-but-not-Connected seller flip a listing to buy_now, after
  // which checkout would 403 (`pro_not_connected`) at the edge function.
  // Refuse the patch here so the seller is told to finish Connect first.
  // Patches that DON'T set purchase_mode, or set it to contact_only, are
  // always allowed.
  if (patch.purchase_mode === 'buy_now') {
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

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .eq('seller_id', gate.sellerId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(
      `[pro/products] update error seller=${gate.sellerId} product=${id}: ${error.message}`,
    );
    return NextResponse.json(
      { error: 'update_failed', details: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  console.log(
    `[pro/products] update ok seller=${gate.sellerId} product=${id} ` +
      `keys=${Object.keys(patch).join(',')}`,
  );

  return NextResponse.json({ ok: true, id: data.id });
}
