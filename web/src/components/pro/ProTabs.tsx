'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';

/**
 * Pro dashboard top tab bar (Track 1).
 *
 * Client Component because `usePathname` (active-tab highlight) is
 * client-only. The parent layout — a Server Component — resolves
 * both PostHog feature flags server-side and passes the resulting
 * booleans as props.
 *
 * Tab visibility:
 *   - Home / Products / Orders → always rendered.
 *   - Customers → rendered iff `showCustomers` (gated by
 *     `show_pro_customers_tab`).
 *   - Analytics → rendered iff `showAnalytics` (gated by
 *     `show_pro_analytics_tab`).
 *   - Account → cross-route to `/dashboard` (the personal
 *     subscription-summary surface). Marked with an external-link
 *     glyph because clicking it leaves the /pro/* namespace.
 */
export function ProTabs({
  showCustomers,
  showAnalytics,
}: {
  showCustomers: boolean;
  showAnalytics: boolean;
}) {
  const t = useTranslations('pro.tabs');
  const pathname = usePathname();

  const tabs: { href: string; label: string }[] = [
    { href: '/pro', label: t('home') },
    { href: '/pro/products', label: t('products') },
    { href: '/pro/orders', label: t('orders') },
  ];
  if (showCustomers) {
    tabs.push({ href: '/pro/customers', label: t('customers') });
  }
  if (showAnalytics) {
    tabs.push({ href: '/pro/analytics', label: t('analytics') });
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-6 lg:px-8">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/pro'
              ? pathname === '/pro'
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative whitespace-nowrap px-3 py-4 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-text-primary" />
              ) : null}
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="ms-auto flex items-center gap-1.5 whitespace-nowrap px-3 py-4 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          {t('account')}
          <ExternalLink size={14} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
