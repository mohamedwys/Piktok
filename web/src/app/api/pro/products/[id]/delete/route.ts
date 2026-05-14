import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro: single product delete (Track 3).
 *
 * Mirrors the shape of `deleteProduct` in
 * src/features/marketplace/services/products.ts:
 *   1. Read the row's `media_url` so we know which storage path to
 *      clean up.
 *   2. Best-effort delete the storage object (failure does not block
 *      the row delete — orphaned media is cheaper to clean up in a
 *      janitor than to roll back the user-visible action).
 *   3. Delete the products row. RLS + the explicit `seller_id` eq
 *      together enforce ownership.
 *
 * Best-effort storage cleanup uses the same cookie-authed SSR client
 * as the read + delete — the storage policies on `product-media`
 * already permit the owning seller to delete their own objects. If
 * the policy denies (e.g., a future policy tightening), the storage
 * call fails silently and the row delete still succeeds; the
 * orphaned object would need to be reaped by a periodic job.
 */
const BUCKET_NAME = 'product-media';
const BUCKET_MARKER = `/${BUCKET_NAME}/`;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (typeof id !== 'string' || id.length === 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();

  const { data: row, error: readErr } = await supabase
    .from('products')
    .select('id, media_url')
    .eq('id', id)
    .eq('seller_id', gate.sellerId)
    .maybeSingle();

  if (readErr) {
    console.error(
      `[pro/products] delete read error seller=${gate.sellerId} product=${id}: ${readErr.message}`,
    );
    return NextResponse.json(
      { error: 'read_failed', details: readErr.message },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Best-effort storage cleanup. We don't block the row delete on this.
  const mediaUrl = (row as { media_url: string | null }).media_url;
  if (typeof mediaUrl === 'string' && mediaUrl.length > 0) {
    const idx = mediaUrl.indexOf(BUCKET_MARKER);
    if (idx >= 0) {
      const path = mediaUrl.substring(idx + BUCKET_MARKER.length);
      const { error: storageErr } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);
      if (storageErr) {
        console.warn(
          `[pro/products] delete storage skipped seller=${gate.sellerId} product=${id} path=${path}: ${storageErr.message}`,
        );
      }
    }
  }

  const { error: deleteErr } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('seller_id', gate.sellerId);
  if (deleteErr) {
    console.error(
      `[pro/products] delete row error seller=${gate.sellerId} product=${id}: ${deleteErr.message}`,
    );
    return NextResponse.json(
      { error: 'delete_failed', details: deleteErr.message },
      { status: 500 },
    );
  }

  console.log(
    `[pro/products] delete ok seller=${gate.sellerId} product=${id}`,
  );

  return NextResponse.json({ ok: true });
}
