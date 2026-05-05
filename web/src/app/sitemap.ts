import type { MetadataRoute } from 'next';

const BASE = 'https://mony-psi.vercel.app';
const LOCALES = ['en', 'fr', 'ar'] as const;
const LEGAL_SLUGS = ['privacy', 'terms', 'child-safety'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const legal = LOCALES.flatMap((locale) =>
    LEGAL_SLUGS.map((slug) => ({
      url:
        locale === 'en'
          ? `${BASE}/legal/${slug}`
          : `${BASE}/${locale}/legal/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    }))
  );

  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    ...legal,
  ];
}
