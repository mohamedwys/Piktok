'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * Admin destructive-action panel (H.11).
 *
 * Three actions on a subscription, each with appropriate
 * friction:
 *
 *   1. Cancel at period end — non-destructive (user keeps Pro
 *      access until period_end; reversible via Stripe portal).
 *      Single-click confirm.
 *
 *   2. Cancel immediately — destructive. Subscription ends
 *      now; user loses Pro access immediately. Typed
 *      confirmation required ("CANCEL").
 *
 *   3. Refund last charge — destructive. Money moves back to
 *      the customer. Typed confirmation required ("REFUND").
 *
 * Implementation: HTML5 `<dialog>` + `<form method="dialog">`
 * for the modal shell, `useState` for typed-input validation.
 * No third-party modal lib needed — `<dialog>` ships with the
 * browser, gets keyboard navigation + Escape-close + scrim
 * for free.
 *
 * Result handling: success → page refresh via
 * `window.location.reload()` so the server re-fetches the
 * subscription row and reflects whatever state Stripe + the
 * H.9 webhook propagated. Error → inline alert below the
 * action panel.
 */
type Props = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  alreadyCancelingAtPeriodEnd: boolean;
  alreadyCanceled: boolean;
};

type ActionResult = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string };

export function AdminActions({
  stripeSubscriptionId,
  stripeCustomerId,
  alreadyCancelingAtPeriodEnd,
  alreadyCanceled,
}: Props) {
  const t = useTranslations('admin');
  const [result, setResult] = useState<ActionResult>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);

  const cancelImmediateDialog = useRef<HTMLDialogElement | null>(null);
  const refundDialog = useRef<HTMLDialogElement | null>(null);

  // Reload after a brief delay on success — gives the user
  // time to read "Action completed" and the H.9 webhook a
  // beat to land before the page re-renders with stale data.
  useEffect(() => {
    if (result.kind === 'success') {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [result]);

  const cancelPeriodEnd = async () => {
    if (submitting) return;
    setSubmitting(true);
    setResult({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_subscription_id: stripeSubscriptionId,
          mode: 'period_end',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResult({ kind: 'success', message: t('success') });
    } catch (err) {
      setResult({
        kind: 'error',
        message: t('error', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelImmediate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setResult({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_subscription_id: stripeSubscriptionId,
          mode: 'immediate',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      cancelImmediateDialog.current?.close();
      setResult({ kind: 'success', message: t('success') });
    } catch (err) {
      cancelImmediateDialog.current?.close();
      setResult({
        kind: 'error',
        message: t('error', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const refund = async () => {
    if (submitting) return;
    setSubmitting(true);
    setResult({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/refund-last-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_customer_id: stripeCustomerId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      refundDialog.current?.close();
      setResult({ kind: 'success', message: t('success') });
    } catch (err) {
      refundDialog.current?.close();
      setResult({
        kind: 'error',
        message: t('error', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          size="md"
          disabled={
            submitting || alreadyCancelingAtPeriodEnd || alreadyCanceled
          }
          onClick={cancelPeriodEnd}
        >
          {t('actionCancelPeriodEnd')}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={submitting || alreadyCanceled}
          onClick={() => cancelImmediateDialog.current?.showModal()}
        >
          {t('actionCancelImmediate')}
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={submitting}
          onClick={() => refundDialog.current?.showModal()}
        >
          {t('actionRefundLast')}
        </Button>
      </div>

      {result.kind === 'success' ? (
        <p
          role="status"
          className="rounded-lg bg-feedback-success/10 px-4 py-3 text-sm text-feedback-success"
        >
          {result.message}
        </p>
      ) : null}
      {result.kind === 'error' ? (
        <p
          role="alert"
          className="rounded-lg bg-feedback-danger/10 px-4 py-3 text-sm text-feedback-danger"
        >
          {result.message}
        </p>
      ) : null}

      <TypedConfirmDialog
        ref={cancelImmediateDialog}
        confirmPhrase="CANCEL"
        title={t('actionCancelImmediate')}
        prompt={t('confirmCancelImmediate')}
        confirmLabel={t('actionCancelImmediate')}
        onConfirm={cancelImmediate}
        submitting={submitting}
      />
      <TypedConfirmDialog
        ref={refundDialog}
        confirmPhrase="REFUND"
        title={t('actionRefundLast')}
        prompt={t('confirmRefund')}
        confirmLabel={t('actionRefundLast')}
        onConfirm={refund}
        submitting={submitting}
      />
    </div>
  );
}

const TypedConfirmDialog = forwardRef<
  HTMLDialogElement,
  {
    confirmPhrase: string;
    title: string;
    prompt: string;
    confirmLabel: string;
    onConfirm: () => void;
    submitting: boolean;
  }
>(function TypedConfirmDialog(
  { confirmPhrase, title, prompt, confirmLabel, onConfirm, submitting },
  ref,
) {
  const t = useTranslations('admin');
  const [typed, setTyped] = useState('');
  const matches = typed === confirmPhrase;

  return (
    <dialog
      ref={ref}
      className="rounded-xl border border-border bg-surface-elevated p-6 text-text-primary shadow-2xl backdrop:bg-overlay-scrim"
    >
      <form
        method="dialog"
        className="w-80 max-w-full space-y-4"
        onSubmit={(e) => {
          // Default <form method="dialog"> closes the dialog without
          // emitting any custom event. We override to run onConfirm
          // first if the typed phrase matches.
          if (matches) {
            e.preventDefault();
            onConfirm();
          }
        }}
      >
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="text-sm text-text-secondary">{prompt}</p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          aria-label={confirmPhrase}
          placeholder={confirmPhrase}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setTyped('');
              (ref as React.RefObject<HTMLDialogElement>).current?.close();
            }}
            className="rounded-pill px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {t('confirmCancel')}
          </button>
          <button
            type="submit"
            disabled={!matches || submitting}
            className="rounded-pill bg-feedback-danger px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
});
