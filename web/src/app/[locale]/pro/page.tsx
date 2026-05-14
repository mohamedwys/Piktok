import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { Container } from '@/components/ui/Container';

/**
 * Pro dashboard home — placeholder (Track 1).
 *
 * Empty shell with a heading + an explanatory note. Track 2
 * replaces this body with the real KPI surface (revenue, listings,
 * orders, conversion). The layout in `./layout.tsx` already gates
 * access via `requirePro()`, but this page repeats the gate as
 * defense-in-depth — every Server Component that reads
 * Pro-scoped data calls the gate itself, so removing the layout
 * never silently exposes data.
 *
 * Force-dynamic — auth + cookie reads.
 */
export const dynamic = 'force-dynamic';

export default async function ProHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePro(locale);

  const t = await getTranslations('pro.home');

  return (
    <main className="py-8">
      <Container>
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-semibold">
            {t('heading')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('subheadPlaceholder')}
          </p>
        </header>

        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="text-sm text-text-secondary">
            {t('placeholderCardBody')}
          </p>
        </div>
      </Container>
    </main>
  );
}
