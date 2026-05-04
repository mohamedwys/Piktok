import { getTranslations } from 'next-intl/server';

/**
 * Subscription status pill — H.10.
 *
 * Visual: small filled dot + label, color-coded per status.
 * Server Component reads `dashboard.status.<status>` from the
 * locale catalog so the label translates per visitor's
 * preference. Tone tokens come from the H.6/H.7 Tailwind
 * theme port — `feedback-success` (active), `verified` (trial),
 * `feedback-warning` (past_due / incomplete),
 * `feedback-danger` (unpaid / incomplete_expired),
 * `text-tertiary` (canceled / paused).
 *
 * The status union mirrors H.2's CHECK constraint exactly.
 * Adding a new status to that constraint requires adding it
 * here AND to the message catalog under `dashboard.status.*`.
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

const TONE: Record<
  SubscriptionStatus,
  { dot: string; text: string; bg: string }
> = {
  active: {
    dot: 'bg-feedback-success',
    text: 'text-feedback-success',
    bg: 'bg-feedback-success/10',
  },
  trialing: {
    dot: 'bg-verified',
    text: 'text-verified',
    bg: 'bg-verified/10',
  },
  past_due: {
    dot: 'bg-feedback-warning',
    text: 'text-feedback-warning',
    bg: 'bg-feedback-warning/10',
  },
  canceled: {
    dot: 'bg-text-tertiary',
    text: 'text-text-tertiary',
    bg: 'bg-text-tertiary/10',
  },
  incomplete: {
    dot: 'bg-feedback-warning',
    text: 'text-feedback-warning',
    bg: 'bg-feedback-warning/10',
  },
  incomplete_expired: {
    dot: 'bg-feedback-danger',
    text: 'text-feedback-danger',
    bg: 'bg-feedback-danger/10',
  },
  unpaid: {
    dot: 'bg-feedback-danger',
    text: 'text-feedback-danger',
    bg: 'bg-feedback-danger/10',
  },
  paused: {
    dot: 'bg-text-tertiary',
    text: 'text-text-tertiary',
    bg: 'bg-text-tertiary/10',
  },
};

export async function StatusPill({
  status,
}: {
  status: SubscriptionStatus;
}) {
  const t = await getTranslations('dashboard.status');
  const tone = TONE[status] ?? TONE.canceled;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}
    >
      <span className={`size-1.5 rounded-pill ${tone.dot}`} />
      {t(status)}
    </span>
  );
}
