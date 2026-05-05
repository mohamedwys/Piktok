import fs from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-static';

type Locale = (typeof routing.locales)[number];

const TITLES: Record<Locale, string> = {
  en: 'Privacy — Mony',
  fr: 'Confidentialité — Mony',
  ar: 'سياسة الخصوصية — Mony',
};

async function loadContent(locale: Locale): Promise<string> {
  const file = path.join(process.cwd(), 'src/content/legal', `privacy.${locale}.md`);
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    const fallback = path.join(process.cwd(), 'src/content/legal', 'privacy.en.md');
    return fs.readFile(fallback, 'utf-8');
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
  return {
    title: TITLES[safeLocale],
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);

  const content = await loadContent(safeLocale);
  return (
    <article className="legal-prose">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  );
}
