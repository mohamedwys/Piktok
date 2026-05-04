import { getTranslations } from 'next-intl/server';
import { StatusPill, type SubscriptionStatus } from './StatusPill';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

/**
 * Local type matching H.2's `public.subscriptions` row shape.
 *
 * Mobile reads this via the generated
 * `Database['public']['Tables']['subscriptions']['Row']` type
 * (from `supabase gen types typescript --linked`). Web has
 * `npm run gen:types` documented but the generated file isn't
 * committed yet — the schema is stable (H.2 migration won't
 * change without a deliberate H.X step), so we hand-roll the
 * subset this component consumes. Swap to a generated import
 * if/when web's `src/types/supabase.ts` lands.
 */
export type SubRow = {
  id: string;
  seller_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string | null;
};

/**
 * Subscription summary card — H.10.
 *
 * Server Component that renders the user's active subscription:
 * plan name, cadence, status pill, renewal-or-cancellation
 * date, and a "Manage subscription" button (Client Component
 * delegate that opens the Stripe Customer Portal).
 *
 * **Cadence detection**: compares `subscription.stripe_price_id`
 * against the three yearly env vars (`STRIPE_PRICE_*_YEARLY`).
 * If any matches, render "Yearly"; otherwise "Monthly". Reading
 * env vars on the server is safe (they're not exposed to the
 * client) and avoids a Stripe API call to look up the price's
 * recurring interval.
 *
 * **Date formatting**: locale-aware via `toLocaleDateString`
 * with a per-locale tag (en-US, fr-FR, ar-AE). Renders as
 * "January 15, 2027" / "15 janvier 2027" / "١٥ يناير ٢٠٢٧".
 *
 * **Cancel-at-period-end**: when true, the "Renews on" label
 * flips to "Cancels on" and an amber warning notice block
 * appears explaining the pending cancellation. The notice
 * directs users to the manage portal where Stripe handles
 * reactivation — we don't ship inline reactivation in v1
 * because Stripe's portal flow is already polished + handles
 * the cross-flow legal language.
 */
export async function SubscriptionSummaryCard({
  subscription,
  locale,
}: {
  subscription: SubRow;
  locale: string;
}) {
  const t = await getTranslations('dashboard');

  const yearlyIds = new Set(
    [
      process.env.STRIPE_PRICE_EUR_YEARLY,
      process.env.STRIPE_PRICE_USD_YEARLY,
      process.env.STRIPE_PRICE_AED_YEARLY,
    ].filter((id): id is string => Boolean(id)),
  );
  const isYearly = yearlyIds.has(subscription.stripe_price_id);
  const cadence: 'monthly' | 'yearly' = isYearly ? 'yearly' : 'monthly';

  const dateLocaleTag =
    locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar-AE' : 'en-US';
  const renewalDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(
        dateLocaleTag,
        { day: 'numeric', month: 'long', year: 'numeric' },
      )
    : '—';

  return (
    <div className="space-y-6 rounded-xl border border-border bg-surface-elevated p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-text-primary">
            {t('plan.title')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Mony Pro · {t(`plan.${cadence}`)}
          </p>
        </div>
        <StatusPill status={subscription.status as SubscriptionStatus} />
      </div>

      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-tertiary">
            {subscription.cancel_at_period_end
              ? t('cancelsOnLabel')
              : t('renewsOnLabel')}
          </dt>
          <dd className="mt-1 font-medium text-text-primary">
            {renewalDate}
          </dd>
        </div>
        {subscription.cancel_at_period_end ? (
          <div className="rounded-lg bg-feedback-warning/10 p-4 text-sm text-feedback-warning sm:col-span-2">
            {t('cancelingNotice')}
          </div>
        ) : null}
      </dl>

      <ManageSubscriptionButton />
    </div>
  );
}
