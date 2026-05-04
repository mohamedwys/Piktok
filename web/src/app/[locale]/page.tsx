import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

/**
 * Mony public landing — locale-aware (H.7.1) + currency-aware
 * (H.7.3).
 *
 * Composition only — the section components carry their own
 * internal layout AND their own translation calls. Server
 * Component throughout (the LanguageSwitcher and CurrencyPicker
 * inside Header are the only client-runtime hops).
 *
 * **Dynamic rendering (H.7.3 change).** Pre-H.7.3 the page was
 * static-prerendered per locale via `setRequestLocale` +
 * `generateStaticParams`. H.7.3 introduces `getCurrency()` which
 * reads cookies + headers — Next.js 15's static-rendering path
 * silently returns empty cookies in that mode, so every visitor
 * would see the default EUR currency regardless of their
 * `NEXT_CURRENCY` cookie. `force-dynamic` makes the page render
 * on every request so the cookie-driven currency resolves
 * correctly. Cost: ~50ms server overhead per request, mitigated
 * by Vercel's edge cache for unchanged HTML; benefit: correct
 * per-visitor currency on first paint without a hydration flicker.
 *
 * `setRequestLocale(locale)` still runs — it primes next-intl's
 * locale resolution for nested Server Components even in dynamic
 * mode. No-op when the page is dynamic but kept for symmetry
 * with the locale-aware tree.
 */
export const dynamic = 'force-dynamic';
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Header />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
