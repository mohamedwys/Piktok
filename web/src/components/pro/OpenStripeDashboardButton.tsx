'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { captureEvent } from '@/lib/posthog-client';

/**
 * "Open Stripe Dashboard" CTA for connected sellers (Track F.C.2).
 *
 * Mints a one-time Express Dashboard login link via the
 * /api/pro/stripe/connect/dashboard route handler (which calls
 * stripe.accounts.createLoginLink). Express login links are short-lived
 * and single-use, so we re-mint on every click rather than caching.
 *
 * Caller is responsible for only rendering this when the seller is
 * connected — the API route 403s otherwise via requireProConnectedApi,
 * but that's a defense-in-depth, not the user-facing affordance.
 */
export function OpenStripeDashboardButton() {
  const t = useTranslations('pro.payouts');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    captureEvent('pro_payouts_dashboard_opened');

    try {
      const res = await fetch('/api/pro/stripe/connect/dashboard', {
        method: 'POST',
      });
      if (!res.ok) {
        setError('generic');
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
        size="md"
        onClick={handleClick}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t('openingDashboard')}
          </>
        ) : (
          <>
            {t('dashboardCta')}
            <ExternalLink size={16} aria-hidden="true" />
          </>
        )}
      </Button>
      {error ? (
        <p className="text-sm text-feedback-danger" role="alert">
          {t('error.generic')}
        </p>
      ) : null}
    </div>
  );
}
