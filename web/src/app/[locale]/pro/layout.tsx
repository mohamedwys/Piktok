import { setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getFeatureFlag } from '@/lib/posthog';
import { ProTabs } from '@/components/pro/ProTabs';

/**
 * Pro dashboard shell (Track 1).
 *
 * Auth-and-Pro gated. Lays out the persistent tab bar above the
 * per-route page content. The two deferred tabs (Customers,
 * Analytics) are PostHog-flag gated — when their flag is false
 * the tab does NOT render at all (no "Coming soon" placeholder).
 *
 * Force-dynamic — `getUser()` reads cookies, PostHog flags resolve
 * per authenticated user, and `setRequestLocale(locale)` is
 * per-request.
 *
 * The active-tab highlight needs `usePathname` which is client-only,
 * so the tab UI is split into <ProTabs /> ('use client'). The flag
 * fetch stays here in the Server Component to keep the PostHog
 * project key off the client bundle and to share one fetch across
 * the whole /pro/* subtree.
 */
export const dynamic = 'force-dynamic';

export default async function ProLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { userId } = await requirePro(locale);

  const [showCustomers, showAnalytics] = await Promise.all([
    getFeatureFlag('show_pro_customers_tab', false, userId),
    getFeatureFlag('show_pro_analytics_tab', false, userId),
  ]);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <ProTabs
        showCustomers={showCustomers}
        showAnalytics={showAnalytics}
      />
      {children}
    </div>
  );
}
