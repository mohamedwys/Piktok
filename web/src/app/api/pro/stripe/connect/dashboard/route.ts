import { NextResponse } from 'next/server';
import { requireProConnectedApi } from '@/lib/pro/auth';
import { stripe } from '@/lib/stripe';

/**
 * Pro: mint a Stripe Express Dashboard login link (Track F.C.2).
 *
 * Stripe Express accounts use a hosted dashboard at
 * `connect.stripe.com/express/<account>` — login links are short-lived
 * (~5 min, single-use) and are minted via
 * `stripe.accounts.createLoginLink`. This route does that mint and
 * returns `{ url }`; the client hard-navigates to it.
 *
 * Gated by `requireProConnectedApi` — the seller must have an Express
 * account AND `charges_enabled = true` to access the dashboard. A
 * not-yet-connected seller has no account to log into; the gate's
 * 403 `pro_not_connected` is the correct surface.
 *
 * Stripe call failures bubble through as 502 with the message included
 * for ops; the client surface degrades to a generic error toast.
 */
export async function POST() {
  const gate = await requireProConnectedApi();
  if (!gate.ok) return gate.response;

  try {
    const link = await stripe.accounts.createLoginLink(gate.stripeAccountId);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error(
      `[pro/stripe/connect/dashboard] mint failed seller=${gate.sellerId}: ${message}`,
    );
    return NextResponse.json(
      { error: 'stripe_error', details: message },
      { status: 502 },
    );
  }
}
