import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { SignInForm } from '@/components/auth/SignInForm';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect({ href: (next ?? '/dashboard') as '/', locale });
  }

  const t = await getTranslations('signIn');

  return (
    <main className="min-h-screen bg-background py-16 text-text-primary">
      <Container>
        <div className="mx-auto max-w-md space-y-8">
          <header className="space-y-3 text-center">
            <h1 className="font-display text-4xl font-semibold">{t('title')}</h1>
            <p className="text-text-secondary">{t('sub')}</p>
          </header>
          <SignInForm next={next ?? '/dashboard'} />
        </div>
      </Container>
    </main>
  );
}
