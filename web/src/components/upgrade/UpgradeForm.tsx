'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * UpgradeForm — Client Component for the /[locale]/upgrade
 * page (H.8).
 *
 * Owns the cadence toggle (monthly/yearly) and the Submit
 * button's submitting / error state. On submit, POSTs to
 * `/api/stripe/checkout` with `{ cadence }`; the server reads
 * NEXT_CURRENCY + NEXT_LOCALE from cookies (no need to send
 * them in the body — they're already part of the request
 * context), creates a Stripe Checkout Session, and returns the
 * hosted-Checkout URL. The form then performs a hard navigation
 * via `window.location.href` since Stripe Checkout is
 * cross-origin.
 *
 * Pricing copy comes pre-resolved from the parent Server
 * Component (Pricing values are currency-aware via
 * `getCurrency()`, which is server-only). Passed as props so
 * the form doesn't have to duplicate the resolution logic.
 *
 * Feature list iterates over the FEATURE_KEYS pattern from
 * `Pricing.tsx` — same 5 keys (`feature1`–`feature5`) under
 * `pricing.*` in the message catalogs. Keeps the form +
 * landing in sync without duplicating copy.
 */
type Props = {
  monthlyPrice: string;
  monthlyCadence: string;
  yearlyPrice: string;
  yearlyCadence: string;
  yearlySavings: string;
};

type Cadence = 'monthly' | 'yearly';

const FEATURE_KEYS = [
  'feature1',
  'feature2',
  'feature3',
  'feature4',
  'feature5',
] as const;

export function UpgradeForm(props: Props) {
  const t = useTranslations('upgrade');
  const tPricing = useTranslations('pricing');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadence }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Checkout failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error('No checkout URL returned');
      // Hard navigation — Stripe Checkout is cross-origin so
      // router.push won't reach it. window.location.href also
      // ensures the back button after Stripe lands us on /upgrade
      // (or wherever the cancel URL points) rather than a stale
      // SPA history entry.
      window.location.href = url;
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : t('genericError'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-text-primary">
          {t('chooseFormula')}
        </legend>
        <PlanOption
          selected={cadence === 'monthly'}
          onSelect={() => setCadence('monthly')}
          label={t('planMonthly')}
          price={props.monthlyPrice}
          cadence={props.monthlyCadence}
        />
        <PlanOption
          selected={cadence === 'yearly'}
          onSelect={() => setCadence('yearly')}
          label={t('planYearly')}
          price={props.yearlyPrice}
          cadence={props.yearlyCadence}
          sub={props.yearlySavings}
        />
      </fieldset>

      <ul className="space-y-3">
        {FEATURE_KEYS.map((key) => (
          <li key={key} className="flex items-start gap-3">
            <Check
              className="mt-0.5 shrink-0 text-brand"
              size={18}
              aria-hidden
            />
            <span className="text-text-secondary">{tPricing(key)}</span>
          </li>
        ))}
      </ul>

      {error ? (
        <p
          role="alert"
          className="text-center text-sm text-feedback-danger"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={submitting}
        className="w-full"
      >
        {submitting ? t('redirecting') : t('subscribe')}
      </Button>

      <p className="text-center text-xs text-text-tertiary">
        {t('securityNote')}
      </p>
    </form>
  );
}

function PlanOption({
  selected,
  onSelect,
  label,
  price,
  cadence,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  price: string;
  cadence: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
        selected
          ? 'border-brand bg-surface-elevated'
          : 'border-border hover:bg-surface-elevated'
      }`}
    >
      <div className="text-start">
        <div className="font-semibold text-text-primary">{label}</div>
        {sub ? <div className="text-xs text-brand">{sub}</div> : null}
      </div>
      <div className="text-end">
        <span className="font-display text-xl font-semibold text-text-primary">
          {price}
        </span>
        <span className="ms-1 text-sm text-text-tertiary">{cadence}</span>
      </div>
    </button>
  );
}
