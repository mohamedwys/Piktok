'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  BarChart3,
  CircleCheck,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { captureEvent } from '@/lib/posthog-client';

/**
 * Activation polling for /upgrade/success (Track 7, Phase D).
 *
 * The Stripe Checkout success URL lands BEFORE the
 * `customer.subscription.created` webhook necessarily completes —
 * webhook propagation runs asynchronously, with a typical sub-2s
 * floor in test mode and a 10–30s tail on cold starts. Until
 * `subscriptions.status='active'` lands, the H.2 trigger has not
 * flipped `sellers.is_pro=true`, so the user is "paid but not yet
 * Pro" for that brief window.
 *
 * State machine:
 *   - 'polling' (initial): renders an "Activating…" surface with a
 *     spinner. Fires `pro_subscription_activation_polled` on every
 *     attempt for funnel telemetry.
 *   - 'activated': server confirmed `is_pro=true`. Renders the
 *     celebration surface — three feature reveal cards + a primary
 *     CTA into the Pro dashboard. Emits `pro_welcome_shown` once on
 *     entry to mirror mobile's modal-mount event.
 *   - 'timeout': 15 attempts (30 s) elapsed without activation.
 *     Renders the manual-refresh fallback + a support link. We do
 *     NOT keep polling indefinitely — at this point the user is
 *     likely on a flaky network or the webhook is genuinely stuck,
 *     and silently looping would burn battery without ever
 *     surfacing the issue.
 *
 * Cadence: fixed 2 s interval. The brief explicitly forbids
 * exponential backoff because the typical hit lands in 2–4 s —
 * starting slow would push the median user further from the
 * activated state for no benefit. setInterval is fine here because
 * we wait at most 30 s; for longer-running polls we'd want a
 * setTimeout chain to avoid pile-ups.
 *
 * Cleanup: the interval handle is cleared on unmount AND on the
 * 'activated'/'timeout' transitions. Without the early clear, a
 * delayed final tick after activation would refetch needlessly.
 *
 * Telemetry posture: we don't have the user UUID at this layer
 * (the Server Component above doesn't pass one to avoid leaking
 * the auth chain to a polling Client Component), so the events
 * land in the `anon-pro` distinct_id bucket. The session cookie
 * handles funnel attribution server-side via PostHog's standard
 * `$session_id` semantics; `pro_welcome_shown` correlates by URL
 * + timestamp.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

type PollState = 'polling' | 'activated' | 'timeout';

export function SuccessActivationPoll({ locale: _locale }: { locale: string }) {
  void _locale;
  const t = useTranslations('pro.success');
  const [state, setState] = useState<PollState>('polling');
  const attemptsRef = useRef(0);
  const welcomeFiredRef = useRef(false);

  useEffect(() => {
    if (state !== 'polling') return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      attemptsRef.current += 1;
      const attempt = attemptsRef.current;
      captureEvent('pro_subscription_activation_polled', { attempt });

      try {
        const res = await fetch('/api/pro/subscription-status', {
          method: 'GET',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { active?: boolean };
          if (body.active === true) {
            if (timer !== null) clearInterval(timer);
            setState('activated');
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

    // Fire the first tick immediately so the user doesn't wait a full
    // 2 s for the first probe — most activations land in the 2–4 s
    // window and the eager first read often hits.
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
    if (state === 'activated' && !welcomeFiredRef.current) {
      welcomeFiredRef.current = true;
      captureEvent('pro_welcome_shown');
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
        <h1 className="font-display text-3xl font-semibold text-text-primary">
          {t('activatingTitle')}
        </h1>
        <p className="text-text-secondary">{t('activatingBody')}</p>
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
        <h1 className="font-display text-3xl font-semibold text-text-primary">
          {t('timeoutHeading')}
        </h1>
        <p className="text-text-secondary">{t('timeoutBody')}</p>
        <div className="flex flex-col items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => window.location.reload()}
          >
            {t('refreshButton')}
          </Button>
          <a
            href="mailto:support@mony.app"
            className="text-sm font-medium text-brand hover:underline"
          >
            {t('supportLink')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <CircleCheck
          className="mx-auto text-feedback-success"
          size={56}
          aria-hidden="true"
        />
        <h1 className="font-display text-4xl font-semibold text-text-primary">
          {t('activatedHeading')}
        </h1>
        <p className="text-text-secondary">{t('activatedSubhead')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FeatureCard
          Icon={Zap}
          title={t('card1Title')}
          body={t('card1Body')}
        />
        <FeatureCard
          Icon={BarChart3}
          title={t('card2Title')}
          body={t('card2Body')}
        />
        <FeatureCard
          Icon={Sparkles}
          title={t('card3Title')}
          body={t('card3Body')}
        />
      </div>

      <div className="flex justify-center">
        <Link
          href="/pro"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-8 py-3.5 text-base font-semibold text-brand-text transition-colors hover:bg-brand-pressed"
        >
          {t('primaryCta')}
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: typeof Zap;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5 text-start">
      <Icon
        size={20}
        className="mb-3 text-brand"
        aria-hidden="true"
      />
      <div className="font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </div>
  );
}
