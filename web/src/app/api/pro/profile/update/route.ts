import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro: minimal seller-profile update used by the Step 2 onboarding
 * editor (Track 7). Only `bio` and `location_text` are accepted —
 * larger fields (avatar, website, contact, geo) are out of scope for
 * v1's onboarding completion surface.
 *
 * The column-level GRANT on public.sellers (20260515) is the
 * authoritative allowlist; even if a forged payload bypassed the
 * sanitizer, the database would reject writes to disallowed columns.
 * The whitelist below is defense-in-depth + clear documentation.
 *
 * Pro gate via `requireProApi` — non-Pro users can edit their seller
 * profile elsewhere (mobile, future web profile editor) but the
 * onboarding endpoint is part of the Pro surface and stays gated for
 * symmetry with the rest of /api/pro/*.
 */
const ALLOWED_KEYS = new Set(['bio', 'location_text']);

function sanitize(raw: unknown): Record<string, string> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    const value = obj[key];
    if (typeof value !== 'string') continue;
    out[key] = value.trim();
  }
  return out;
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

  const patch = sanitize(raw);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('sellers')
    .update(patch)
    .eq('id', gate.sellerId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(
      `[pro/profile] update error seller=${gate.sellerId}: ${error.message}`,
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
    `[pro/profile] update ok seller=${gate.sellerId} keys=${Object.keys(patch).join(',')}`,
  );

  return NextResponse.json({ ok: true });
}
