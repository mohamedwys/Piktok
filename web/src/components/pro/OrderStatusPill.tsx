import { getTranslations } from 'next-intl/server';
import type { SellerOrderStatus } from '@/lib/pro/data';

/**
 * Order status pill (Track 4).
 *
 * Visual: filled dot + tone-coded label. Tones mirror the subscription
 * StatusPill convention (H.7): feedback-success for "paid", feedback-warning
 * for "pending", feedback-danger for "failed", text-tertiary for "cancelled"
 * and "refunded". Server Component reads `pro.orders.filter.<status>` so
 * the label translates per visitor's preference — the filter pills and the
 * status pill share the same labels by design (same word in every locale).
 *
 * Adding a new status to the orders CHECK constraint requires adding a tone
 * mapping here AND a `pro.orders.filter.<status>` entry in every locale
 * catalog.
 */
const TONE: Record<
  SellerOrderStatus,
  { dot: string; text: string; bg: string }
> = {
  paid: {
    dot: 'bg-feedback-success',
    text: 'text-feedback-success',
    bg: 'bg-feedback-success/10',
  },
  pending: {
    dot: 'bg-feedback-warning',
    text: 'text-feedback-warning',
    bg: 'bg-feedback-warning/10',
  },
  failed: {
    dot: 'bg-feedback-danger',
    text: 'text-feedback-danger',
    bg: 'bg-feedback-danger/10',
  },
  cancelled: {
    dot: 'bg-text-tertiary',
    text: 'text-text-tertiary',
    bg: 'bg-text-tertiary/10',
  },
  refunded: {
    dot: 'bg-text-tertiary',
    text: 'text-text-tertiary',
    bg: 'bg-text-tertiary/10',
  },
};

export async function OrderStatusPill({
  status,
}: {
  status: SellerOrderStatus;
}) {
  const t = await getTranslations('pro.orders.filter');
  const tone = TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}
    >
      <span className={`size-1.5 rounded-pill ${tone.dot}`} />
      {t(status)}
    </span>
  );
}
