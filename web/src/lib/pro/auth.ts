import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro gating helpers (Track 1).
 *
 * Two flavors mirroring the admin gate at `@/lib/admin/auth.ts`:
 *   - `requirePro(locale)` for Server Component pages — uses
 *     `next-intl`'s locale-aware `redirect` so non-Pro visitors
 *     bounce to `/upgrade` and unauthenticated visitors bounce
 *     to `/`, both with their language preference preserved.
 *   - `requireProApi()` for Route Handlers — returns a
 *     discriminated `{ ok, response }` so the handler can pass
 *     the failure response straight back to the client. API
 *     routes never redirect; they return JSON status codes.
 *
 * **Source of truth.** Pro status is read from `sellers.is_pro`,
 * not from `subscriptions.status`. The `handle_subscription_change`
 * trigger on the `subscriptions` table is the single writer of
 * `is_pro` — it flips the flag on every status transition (active,
 * trialing, past_due, canceled, …). Reading the trigger-maintained
 * boolean is one cheap indexed lookup and keeps the gate behavior
 * symmetric across Stripe (webhook) and IAP (validate-iap-receipt)
 * upgrade paths.
 *
 * **Defense-in-depth.** Every Pro surface (page AND API) calls one
 * of these helpers BEFORE any privileged action. Even if one layer
 * were misconfigured (a future bug in a layout, middleware
 * accidentally skipping /pro), the per-request check inside the
 * handler still gates access.
 *
 * The check uses the SSR cookie-authed Supabase client (NOT the
 * service-role admin client). Reading `is_pro` is a personal lookup
 * against the caller's own seller row — the H.6 RLS policy
 * `sellers public read` already allows it. Using the cookie-authed
 * client preserves the auth chain and avoids service-role bleed.
 *
 * Failure modes:
 *   - unauthenticated → `/` (sign-in entry point on the landing).
 *   - no seller row → `/` (treat as unauthenticated for this surface).
 *   - authenticated + not Pro → `/upgrade` (conversion funnel).
 */

export async function requirePro(
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
    .select('id, is_pro')
    .eq('user_id', user!.id)
    .maybeSingle();

  if (!seller) {
    redirect({ href: '/', locale });
  }

  if (!seller!.is_pro) {
    redirect({ href: '/upgrade', locale });
  }

  // After redirect throws, narrowing isn't possible — we know
  // execution only reaches here on the happy path.
  return { userId: user!.id, sellerId: seller!.id };
}

type ProApiResult =
  | { ok: true; userId: string; sellerId: string }
  | { ok: false; response: Response };

export async function requireProApi(): Promise<ProApiResult> {
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
    .select('id, is_pro')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!seller) {
    return {
      ok: false,
      response: jsonError('forbidden', 403),
    };
  }

  if (!seller.is_pro) {
    // Distinct from the admin gate's `forbidden` — Pro-required
    // surfaces want clients to branch UI (e.g., show an upgrade
    // CTA) instead of a generic "you don't have access" copy.
    return {
      ok: false,
      response: jsonError('pro_required', 403),
    };
  }

  return { ok: true, userId: user.id, sellerId: seller.id };
}

/**
 * Stricter Pro gate that ALSO requires Stripe Connect to be active —
 * meaning `stripe_account_id` is set AND `stripe_charges_enabled = true`
 * on the caller's seller row. Tracks F.C.2+ surfaces (open Stripe
 * Express Dashboard, refund a destination charge, surface payout
 * timeseries) all need an active Connect account; without one there's
 * no Stripe-side anchor to act against.
 *
 * Failure mode is DELIBERATELY NOT a redirect to /upgrade — the caller
 * IS Pro, they just haven't finished Connect. Bouncing them through the
 * upgrade funnel would be confusing. Instead they go to /pro/payouts,
 * which is the onboarding surface itself.
 *
 * Returns the resolved `stripeAccountId` so callers don't need a second
 * round-trip; every consumer of this gate is about to call a Stripe
 * Connect API that needs the account id anyway.
 */
export async function requireProConnected(
  locale: string,
): Promise<{ userId: string; sellerId: string; stripeAccountId: string }> {
  const { userId, sellerId } = await requirePro(locale);

  const supabase = await getSupabaseServer();
  const { data: seller } = await supabase
    .from('sellers')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', sellerId)
    .maybeSingle();

  const accountId = (seller?.stripe_account_id as string | null) ?? null;
  const chargesEnabled = seller?.stripe_charges_enabled === true;
  if (!accountId || !chargesEnabled) {
    redirect({ href: '/pro/payouts', locale });
  }

  // After redirect throws, narrowing isn't possible — execution only
  // reaches here on the happy path.
  return { userId, sellerId, stripeAccountId: accountId! };
}

type ProConnectedApiResult =
  | { ok: true; userId: string; sellerId: string; stripeAccountId: string }
  | { ok: false; response: Response };

/**
 * Route-handler equivalent of `requireProConnected`. Discriminated-union
 * shape mirrors `requireProApi`; the `pro_not_connected` error code is
 * distinct from `pro_required` so a Connect-gated client can branch UI
 * (e.g., "finish onboarding" CTA) instead of the upgrade funnel.
 */
export async function requireProConnectedApi(): Promise<ProConnectedApiResult> {
  const gate = await requireProApi();
  if (!gate.ok) return gate;

  const supabase = await getSupabaseServer();
  const { data: seller } = await supabase
    .from('sellers')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', gate.sellerId)
    .maybeSingle();

  const accountId = (seller?.stripe_account_id as string | null) ?? null;
  const chargesEnabled = seller?.stripe_charges_enabled === true;
  if (!accountId || !chargesEnabled) {
    return {
      ok: false,
      response: jsonError('pro_not_connected', 403),
    };
  }

  return {
    ok: true,
    userId: gate.userId,
    sellerId: gate.sellerId,
    stripeAccountId: accountId,
  };
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
