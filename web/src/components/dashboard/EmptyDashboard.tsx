import { getTranslations } from 'next-intl/server';
import { Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

/**
 * Empty-state for /dashboard when the user has no
 * subscription row (H.10).
 *
 * Reasons we end up here:
 *   - User has never subscribed (most common — this is the
 *     primary case the empty state serves).
 *   - User canceled and the row was hard-deleted somehow
 *     (rare; H.9 webhook leaves canceled rows in place).
 *   - Webhook hasn't propagated yet (~2s race window after
 *     completing Checkout). The success page handles this
 *     gracefully with "processing" copy; the dashboard's
 *     empty state is a defensive fallback.
 *
 * The CTA routes to `/upgrade` (locale-aware via the
 * next-intl `Link` from `@/i18n/routing`). The Pro upgrade
 * flow itself is auth-gated and currency-aware per H.7.3 / H.8.
 */
export async function EmptyDashboard() {
  const t = await getTranslations('dashboard.empty');

  return (
    <div className="space-y-6 rounded-xl border border-border bg-surface-elevated p-12 text-center">
      <Sparkles className="mx-auto text-brand" size={48} aria-hidden />
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          {t('title')}
        </h2>
        <p className="mx-auto max-w-sm text-text-secondary">
          {t('body')}
        </p>
      </div>
      <Link href="/upgrade" className="inline-block">
        <Button variant="primary" size="lg">
          {t('cta')}
        </Button>
      </Link>
    </div>
  );
}
