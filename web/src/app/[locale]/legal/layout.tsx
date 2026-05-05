import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('legal');
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <Link href="/" className="text-sm text-zinc-500 hover:text-[#FF5A5C]">
        ← {t('backHome')}
      </Link>
      <div className="mt-8">{children}</div>
    </main>
  );
}
