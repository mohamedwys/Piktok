'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CircleCheck, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { captureEvent } from '@/lib/posthog-client';

/**
 * Activation polling for /pro/payouts/return (Track F.C.2).
 *
 * Mirrors the shape of `SuccessActivationPoll` (Track 7 D) but observes
 * a different state transition: the Stripe `account.updated` webhook
 * flips `sellers.stripe_charges_enabled` (and the derived
 * `SellerConnectState.status`) from 'in_progress' to 'connected'.
 *
 * State machine:
 *   - 'polling' (initial): spinner + "Verifying your account…" copy.
 *     Fires `pro_payouts_return_polled` per attempt for funnel
 *     telemetry.
 *   - 'success': server confirmed `status = 'connected'`. Renders the
 *     confirmation surface + "Back to Pro dashboard" CTA. Emits
 *     `pro_payouts_connected_shown` once on entry.
 *   - 'timeout': 15 attempts (30 s total) elapsed without the flip.
 *     Renders a manual-refresh fallback. We do NOT keep polling
 *     indefinitely — at this point the webhook is likely backed up
 *     and silent looping wastes the user's time without surfacing the
 *     issue.
 *
 * Cadence: fixed 2 s interval. Same reasoning as the subscription
 * activation poll — the median webhook tail is 2–4 s, so backoff
 * would push the median user further from connection for no benefit.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

type PollState = 'polling' | 'success' | 'timeout';

export function ReturnPollClient() {
  const t = useTranslations('pro.payouts');
  const [state, setState] = useState<PollState>('polling');
  const attemptsRef = useRef(0);
  const successFiredRef = useRef(false);

  useEffect(() => {
    if (state !== 'polling') return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      attemptsRef.current += 1;
      const attempt = attemptsRef.current;
      captureEvent('pro_payouts_return_polled', { attempt });

      try {
        const res = await fetch('/api/pro/stripe/connect/status', {
          method: 'GET',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { status?: string };
          if (body.status === 'connected') {
            if (timer !== null) clearInterval(timer);
            setState('success');
            return;
          }
        }
      } catch {
        // Network blips are non-fatal — the next interval retry will
        // either catch the activation or eventually time out.
      }

      if (attempt >= POLL_MAX_ATTEMPTS) {
        if (timer !== null) clearInterval(timer);
        setState('timeout');
      }
    };

    // Eager first tick — most webhooks land within the first 2-4 s and
    // the immediate read often hits without making the user wait.
    void tick();
    timer = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
    };
  }, [state]);

  useEffect(() => {
    if (state === 'success' && !successFiredRef.current) {
      successFiredRef.current = true;
      captureEvent('pro_payouts_connected_shown');
    }
  }, [state]);

  if (state === 'polling') {
    return (
      <div className="space-y-4 text-center">
        <Loader2
          className="mx-auto animate-spin text-text-secondary"
          size={48}
          aria-hidden="true"
        />
        <p className="text-text-secondary">{t('return.polling')}</p>
      </div>
    );
  }

  if (state === 'timeout') {
    return (
      <div className="space-y-5 text-center">
        <AlertCircle
          className="mx-auto text-feedback-warning"
          size={48}
          aria-hidden="true"
        />
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          {t('return.timeout.heading')}
        </h1>
        <p className="text-text-secondary">{t('return.timeout.body')}</p>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => window.location.reload()}
          >
            {t('return.timeout.cta')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <CircleCheck
        className="mx-auto text-feedback-success"
        size={56}
        aria-hidden="true"
      />
      <h1 className="font-display text-3xl font-semibold text-text-primary">
        {t('return.success.heading')}
      </h1>
      <p className="text-text-secondary">{t('return.success.body')}</p>
      <div className="flex justify-center">
        <Link
          href="/pro"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-8 py-3.5 text-base font-semibold text-brand-text transition-colors hover:bg-brand-pressed"
        >
          {t('return.success.cta')}
        </Link>
      </div>
    </div>
  );
}
