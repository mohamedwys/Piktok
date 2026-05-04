import Stripe from 'stripe';
import type { Currency } from '@/i18n/currency';

/**
 * Server-side Stripe SDK initialization (H.8).
 *
 * Module-level singleton — Stripe's client manages its own
 * connection pooling and is safe to instantiate once per
 * runtime instance. Re-creating per request would waste TLS
 * setup and metric overhead.
 *
 * `STRIPE_SECRET_KEY` MUST be set in the environment. Throwing
 * at module load (rather than at request time) means a missing
 * key surfaces during `next build` / startup, not at the first
 * Checkout attempt — fail-fast for ops.
 *
 * `apiVersion` is pinned to the SDK's bundled version so the
 * generated TypeScript types align with what Stripe accepts.
 * Don't bump this without bumping the `stripe` package and
 * vetting the changelog for breaking changes.
 *
 * `appInfo` is sent on every request as `User-Agent` metadata —
 * helps Stripe Support correlate issues to our integration if
 * we ever need to escalate.
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    '[H.8] STRIPE_SECRET_KEY is not set. Add it to .env.local ' +
      '(and Vercel project env vars for production).',
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
  appInfo: {
    name: 'Mony',
    version: '0.1.0',
  },
});

export type Cadence = 'monthly' | 'yearly';

/**
 * Resolves a Stripe Price ID from (currency, cadence) by
 * composing the env var name `STRIPE_PRICE_<CURRENCY>_<CADENCE>`
 * — the convention documented in `.env.local.example` and
 * established by H.7.3.
 *
 * Six prices total (3 currencies × 2 cadences). Each maps 1:1 to
 * a Stripe Price object the user creates in the Dashboard on
 * the Mony Pro Product.
 *
 * Throws on missing env var. The API route catches and returns
 * a 500 with `error: 'price_unavailable'` rather than letting
 * Stripe fail with `No such price` — clearer ops signal.
 */
export function getStripePriceId(
  currency: Currency,
  cadence: Cadence,
): string {
  const envVar = `STRIPE_PRICE_${currency.toUpperCase()}_${cadence.toUpperCase()}`;
  const id = process.env[envVar];
  if (!id) {
    throw new Error(`${envVar} is not set`);
  }
  return id;
}
