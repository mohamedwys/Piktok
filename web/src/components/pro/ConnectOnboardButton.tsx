'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { captureEvent } from '@/lib/posthog-client';
import type { ConnectCountry } from './ConnectCountryPicker';

/**
 * "Connect Stripe" / "Resume onboarding" CTA for /pro/payouts (Track F.C.2).
 *
 * One client component for both states — the only delta is the label and
 * the telemetry `isResume` flag. The POST is identical: the F.C.1 edge
 * function is sticky on `stripe_account_id`, so a Resume click against
 * an existing account just mints a fresh account link rather than
 * creating a new account.
 *
 * On success: hard-navigate (window.location.href) to Stripe-hosted URL.
 * Soft-navigation via next/navigation router would treat the URL as an
 * in-app route and 404; this is an external redirect.
 *
 * Error surface: inline below the button, with a "Try again" affordance
 * baked into the button itself (re-clicking re-POSTs). The error message
 * uses the localized generic copy by default and the
 * country-not-supported copy when the server returns that specific code.
 */
type Props = {
  country: ConnectCountry;
  isResume: boolean;
};

export function ConnectOnboardButton({ country, isResume }: Props) {
  const t = useTranslations('pro.payouts');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    captureEvent('pro_payouts_onboard_started', { isResume, country });

    try {
      const res = await fetch('/api/pro/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
      });
      if (!res.ok) {
        let code = 'generic';
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error === 'country_not_supported') {
            code = 'countryNotSupported';
          }
        } catch {
          // body wasn't json — keep generic
        }
        setError(code);
        setSubmitting(false);
        return;
      }
      const body = (await res.json()) as { url?: string };
      if (!body.url) {
        setError('generic');
        setSubmitting(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError('generic');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={handleClick}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            {t('connectingCta')}
          </>
        ) : (
          <>
            {isResume ? t('resumeCta') : t('connectCta')}
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </Button>
      {error ? (
        <p className="text-sm text-feedback-danger" role="alert">
          {error === 'countryNotSupported'
            ? t('error.countryNotSupported')
            : t('error.generic')}
        </p>
      ) : null}
    </div>
  );
}
