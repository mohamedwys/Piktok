'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * "Manage subscription" Client Component (H.10).
 *
 * POSTs to `/api/stripe/portal` and redirects to the returned
 * Stripe-hosted Customer Portal URL via `window.location.href`.
 * The portal handles all billing flows (cancel, change plan,
 * update payment method, view invoices) so we don't duplicate
 * Stripe's UX — one click sends the user there and Stripe
 * handles the rest.
 *
 * Why hard navigation: the portal is cross-origin
 * (`billing.stripe.com`), so `router.push` won't reach it.
 * `window.location.href` also keeps the back button intuitive
 * — pressing back from the portal lands on /dashboard.
 *
 * Error handling: shown inline below the button rather than
 * via toast (no toast primitive in the web codebase yet, and
 * portal failures are rare). On error the button re-enables so
 * the user can retry.
 */
export function ManageSubscriptionButton() {
  const t = useTranslations('dashboard');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Portal failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error('No portal URL returned');
      window.location.href = url;
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : t('manageError'));
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleClick}
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? t('manageOpening') : t('manageButton')}
      </Button>
      {error ? (
        <p
          role="alert"
          className="text-sm text-feedback-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
