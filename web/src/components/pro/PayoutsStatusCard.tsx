import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Clock } from 'lucide-react';
import type { SellerConnectState } from '@/lib/pro/data';
import { OpenStripeDashboardButton } from './OpenStripeDashboardButton';

/**
 * Connected-state surface for /pro/payouts (Track F.C.2).
 *
 * Server Component — renders the read-only Connect status (country,
 * charges/payouts badges, onboarded date) plus the
 * `OpenStripeDashboardButton` Client Component for the one interactive
 * affordance the surface needs.
 *
 * The "Disconnect" link is intentionally absent: Stripe Express
 * accounts can only be deauthorized by the seller themselves from the
 * Stripe Dashboard (the platform — Mony — cannot revoke an Express
 * account on the seller's behalf without their consent). The
 * `disconnectTooltip` copy is staged in the locale catalog for a future
 * Standard Connect surface that supports platform-side deauthorization,
 * but the link itself is not rendered here.
 */
export async function PayoutsStatusCard({
  state,
  locale,
}: {
  state: SellerConnectState;
  locale: string;
}) {
  const t = await getTranslations('pro.payouts');

  // Country label resolution: try the locale catalog first (covers all 14
  // allowed countries with localized names); fall back to ISO-2 if the
  // catalog is missing the key (e.g., a future country added to the
  // backend before the locales caught up).
  const countryLabel = state.country
    ? safeCountryLabel(t, state.country)
    : null;

  // Onboarded-at: format with the user's locale. If null (legacy rows
  // where the timestamp wasn't backfilled), skip the row entirely.
  const onboardedAtFormatted = state.onboardedAt
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(state.onboardedAt))
    : null;

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-5">
      <p className="text-sm text-text-secondary">
        {t('subhead.connected')}
      </p>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {countryLabel ? (
          <Field label={t('countryLabel')} value={countryLabel} />
        ) : null}
        <Field
          label={t('statusCharges.label')}
          value={
            <StatusBadge
              ok={state.chargesEnabled}
              labelOk={t('statusCharges.enabled')}
              labelPending={t('statusCharges.disabled')}
            />
          }
        />
        <Field
          label={t('statusPayouts.label')}
          value={
            <StatusBadge
              ok={state.payoutsEnabled}
              labelOk={t('statusPayouts.enabled')}
              labelPending={t('statusPayouts.disabled')}
            />
          }
        />
      </dl>

      {onboardedAtFormatted ? (
        <p className="text-sm text-text-secondary">
          {t('onboardedAt', { date: onboardedAtFormatted })}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-1">
        <OpenStripeDashboardButton />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-secondary">
        {label}
      </dt>
      <dd className="mt-1 text-base text-text-primary">{value}</dd>
    </div>
  );
}

function StatusBadge({
  ok,
  labelOk,
  labelPending,
}: {
  ok: boolean;
  labelOk: string;
  labelPending: string;
}) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-feedback-success/10 px-2.5 py-1 text-sm font-medium text-feedback-success">
        <CheckCircle2 size={14} aria-hidden="true" />
        {labelOk}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-feedback-warning/10 px-2.5 py-1 text-sm font-medium text-feedback-warning">
      <Clock size={14} aria-hidden="true" />
      {labelPending}
    </span>
  );
}

/**
 * Look up `pro.payouts.country.<ISO>` and gracefully fall back to the
 * raw ISO-2 code if the catalog doesn't have the key. `getTranslations`
 * throws on a missing key by default; we catch and degrade to the code
 * so a future allow-list expansion doesn't break the page before the
 * locale files are updated.
 */
function safeCountryLabel(
  t: Awaited<ReturnType<typeof getTranslations>>,
  iso: string,
): string {
  try {
    return t(`country.${iso}`);
  } catch {
    return iso;
  }
}
