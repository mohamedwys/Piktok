import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

/**
 * Hero section — the page's first impression.
 *
 * Composition follows BRAND.md: Fraunces display heading, Inter
 * body, generous spacing, coral accent reserved for the single
 * primary CTA. Decorative twin radial gradients (coral + violet)
 * serve as the v1 backdrop — pure CSS, no asset dependency.
 *
 * Headline localization splits "lead" (the part rendered in
 * default text color) from "accent" (the part rendered in coral).
 * Translators control the breakpoint by deciding where to put
 * the cut between the two strings — e.g., FR puts the conjugated
 * "Connectez-vous." in `headlineAccent`, EN puts the imperative
 * "Connect.". This keeps the visual emphasis intact across
 * locales without requiring HTML in the message catalog.
 */
export async function Hero() {
  const t = await getTranslations('hero');

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 90, 92, 0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 30%, rgba(139, 92, 246, 0.10), transparent 70%)',
        }}
      />

      <Container>
        <div className="flex flex-col items-center pt-32 pb-24 text-center md:pt-40 md:pb-32">
          <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-text-primary md:text-6xl lg:text-7xl">
            {t('headlineLead')}
            <span className="text-brand">{t('headlineAccent')}</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl">
            {t('sub')}
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a href="#pricing">
              <Button variant="primary" size="lg">
                {t('ctaPrimary')}
              </Button>
            </a>
            <a href="#download">
              <Button variant="outline" size="lg">
                {t('ctaSecondary')}
              </Button>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
