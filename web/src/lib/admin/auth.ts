import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Admin gating helpers (H.11).
 *
 * Two flavors for two contexts:
 *   - `requireAdmin(locale)` for Server Component pages — uses
 *     `next-intl`'s locale-aware `redirect` to bounce non-admins
 *     to `/` (preserves their language preference).
 *   - `requireAdminApi()` for Route Handlers — returns a
 *     discriminated `{ ok, response }` so the handler can pass
 *     the failure response straight back to the client. API
 *     routes never redirect; they return JSON status codes.
 *
 * **Defense-in-depth.** Every admin surface (page AND API)
 * calls one of these helpers BEFORE any privileged action.
 * Even if one layer were misconfigured (middleware accidentally
 * skipping /admin, a future bug in a layout), the per-request
 * check inside the handler still gates access. A compromised
 * page-level gate alone would NOT expose the cancel / refund
 * routes — those have their own check.
 *
 * The check uses the SSR cookie-authed Supabase client (NOT the
 * service-role admin client). Reading `is_admin` is a personal
 * lookup against the caller's own seller row — the H.6 RLS
 * policy `sellers public read` already allows it. Using the
 * cookie-authed client preserves the auth chain and avoids
 * service-role bleed.
 *
 * Service-role usage in `/admin/*` happens AFTER these helpers
 * verify the caller — privileged DB reads (cross-user
 * subscription queries) are gated by the same boolean.
 */

export async function requireAdmin(
  locale: string,
): Promise<{ userId: string; sellerId: string }> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: '/', locale });
  }

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, is_admin')
    .eq('user_id', user!.id)
    .maybeSingle();

  if (!seller || !seller.is_admin) {
    redirect({ href: '/', locale });
  }

  // After redirect throws, narrowing isn't possible — we know
  // execution only reaches here on the happy path.
  return { userId: user!.id, sellerId: seller!.id };
}

type AdminApiResult =
  | { ok: true; userId: string; sellerId: string }
  | { ok: false; response: Response };

export async function requireAdminApi(): Promise<AdminApiResult> {
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
    .select('id, is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!seller || !seller.is_admin) {
    return {
      ok: false,
      response: jsonError('forbidden', 403),
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
