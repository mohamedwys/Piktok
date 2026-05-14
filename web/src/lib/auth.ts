import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Generic auth gate for Route Handlers that need a signed-in user but
 * MUST NOT require Pro status.
 *
 * The motivating caller is `/api/pro/subscription-status`, polled by
 * `/upgrade/success` while the Stripe webhook is in flight. Using
 * `requireProApi` there would 403 the user during the very window
 * we're trying to observe (`is_pro` flips from false to true). We
 * still need an auth check though — the polling endpoint must not be
 * a probe surface for "is this user Pro yet?" against arbitrary
 * `seller_id`s.
 *
 * Mirrors the discriminated-union shape of `requireProApi` so callers
 * can use the same `if (!gate.ok) return gate.response;` idiom. On
 * success the helper resolves the seller row (one cookie-authed
 * lookup) so the calling route doesn't need a second round-trip — the
 * one-and-only legitimate consumer needs both `userId` and
 * `sellerId`. If a future caller only needs `userId`, accepting the
 * extra unused field is cheaper than splitting into two helpers.
 *
 * Failure modes:
 *   - unauthenticated → 401 `{ error: 'unauthorized' }`.
 *   - no seller row → 404 `{ error: 'no_seller' }` (distinct from
 *     `requireProApi`'s 403/`forbidden` because for an
 *     auth-without-pro caller a missing seller is a genuine
 *     not-found, not a permission issue).
 */

type UserApiResult =
  | { ok: true; userId: string; sellerId: string }
  | { ok: false; response: Response };

export async function requireUser(): Promise<UserApiResult> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: jsonError('unauthorized', 401),
    };
  }

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!seller) {
    return {
      ok: false,
      response: jsonError('no_seller', 404),
    };
  }

  return { ok: true, userId: user.id, sellerId: seller.id };
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
