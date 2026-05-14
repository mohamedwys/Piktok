import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { ProProfileEditor } from '@/components/pro/ProProfileEditor';

/**
 * Pro profile editor — destination for Step 2 of the onboarding
 * checklist (Track 7). Intentionally minimal: bio + location only.
 * A richer profile editor (avatar, contact methods, website,
 * interests) is out of scope for the onboarding-completion surface
 * and would belong on a dedicated /pro/account or /pro/settings
 * page in a later track.
 *
 * Force-dynamic — `requirePro()` reads cookies and the seller fetch
 * depends on the authenticated caller.
 */
export const dynamic = 'force-dynamic';

export default async function ProProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);

  const supabase = await getSupabaseServer();
  const [sellerResult, t] = await Promise.all([
    supabase
      .from('sellers')
      .select('bio, location_text')
      .eq('id', sellerId)
      .maybeSingle(),
    getTranslations('pro.profile'),
  ]);

  const row = sellerResult.data as
    | { bio: string | null; location_text: string | null }
    | null;
  const initial = {
    bio: row?.bio ?? '',
    locationText: row?.location_text ?? '',
  };

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>
        </header>

        <div className="max-w-2xl">
          <ProProfileEditor initial={initial} />
        </div>
      </Container>
    </main>
  );
}
