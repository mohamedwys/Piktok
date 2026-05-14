import { getTranslations } from 'next-intl/server';
import { MessageSquare, ShoppingBag } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { ActivityEvent } from '@/lib/pro/data';

/**
 * Recent activity feed for the /pro home page (Track 2).
 *
 * Renders the merged + sorted events from `fetchRecentActivity` as a
 * vertical list of up to 10 rows. Each row has an icon, a single-line
 * summary, and a right-aligned relative timestamp.
 *
 * Linking strategy:
 *   - order_paid       → /pro/orders/{id}  (Track 4 will land that
 *                         route; for now the link resolves to a 404,
 *                         which is acceptable for a feature that
 *                         hasn't shipped yet — the row is informative
 *                         standalone).
 *   - message_received → not linked. There is no web messaging
 *                         surface in v1 (the mobile app owns the
 *                         conversation UI); a desktop deep link to
 *                         a mobile-only route would dead-end. The
 *                         row still surfaces the inbound-message
 *                         signal so the seller knows to open the app.
 *
 * Relative timestamps use `Intl.RelativeTimeFormat`, picking the
 * largest unit that fits ("3 min ago", "2 h ago", "5 d ago"). The
 * component is a Server Component, so the formatting runs once at
 * render time — there's no live tick. A 3-minute-old event will read
 * "3 min ago" until the next request; this matches the existing
 * Pro-screen activity treatment on mobile.
 */
export async function RecentActivityFeed({
  events,
  locale,
}: {
  events: ActivityEvent[];
  locale: string;
}) {
  const t = await getTranslations('pro');

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary">
        {t('activity.empty')}
      </div>
    );
  }

  const dateLocaleTag =
    locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar-AE' : 'en-US';
  const relativeFormatter = new Intl.RelativeTimeFormat(dateLocaleTag, {
    numeric: 'auto',
  });
  const moneyFormatterForOrder = (currency: string) =>
    new Intl.NumberFormat(dateLocaleTag, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
  const now = Date.now();

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-elevated">
      {events.map((event) => (
        <li key={`${event.kind}-${event.id}`}>
          <ActivityRow
            event={event}
            t={t}
            relativeFormatter={relativeFormatter}
            moneyFormatterForOrder={moneyFormatterForOrder}
            now={now}
          />
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({
  event,
  t,
  relativeFormatter,
  moneyFormatterForOrder,
  now,
}: {
  event: ActivityEvent;
  // next-intl's translator type isn't directly exported in a stable
  // shape across versions; the prop is structurally an async-resolved
  // translator returning `string`. Inline its callable shape rather
  // than importing a private type.
  t: (key: string, values?: Record<string, string | number>) => string;
  relativeFormatter: Intl.RelativeTimeFormat;
  moneyFormatterForOrder: (currency: string) => Intl.NumberFormat;
  now: number;
}) {
  const rowClass =
    'flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface';
  const timestamp = (
    <time
      dateTime={event.at}
      className="ms-auto whitespace-nowrap text-xs text-text-tertiary"
    >
      {formatRelative(now, new Date(event.at).getTime(), relativeFormatter)}
    </time>
  );

  if (event.kind === 'order_paid') {
    const summary = t('activity.orderPaid', {
      buyerName: event.buyerName ?? t('activity.buyerNamePlaceholder'),
      amount: moneyFormatterForOrder(event.currency).format(event.amount),
    });
    return (
      <Link href={`/pro/orders/${event.id}`} className={rowClass}>
        <ShoppingBag
          size={18}
          className="shrink-0 text-text-secondary"
          aria-hidden="true"
        />
        <span className="truncate text-text-primary">{summary}</span>
        {timestamp}
      </Link>
    );
  }

  // message_received
  return (
    <div className={rowClass}>
      <MessageSquare
        size={18}
        className="shrink-0 text-text-secondary"
        aria-hidden="true"
      />
      <span className="truncate text-text-primary">
        {t('activity.messageReceived')}
      </span>
      {timestamp}
    </div>
  );
}

/**
 * Pick the largest time unit that fits the elapsed duration and
 * format it via `Intl.RelativeTimeFormat`. Returns past values (-1
 * minute → "1 minute ago" / "il y a 1 minute"). Capped at days; an
 * event older than a week still reads "7 d ago" rather than weeks
 * because the dashboard's activity feed is meant to surface the
 * very recent past — older entries paginate out via the `limit` cap.
 */
function formatRelative(
  nowMs: number,
  pastMs: number,
  formatter: Intl.RelativeTimeFormat,
): string {
  const diffSeconds = Math.round((pastMs - nowMs) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return formatter.format(diffSeconds, 'second');
  }
  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffSeconds / 60), 'minute');
  }
  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  }
  return formatter.format(Math.round(diffSeconds / 86400), 'day');
}
