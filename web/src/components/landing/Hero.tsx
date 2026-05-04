import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

/**
 * Hero section — the page's first impression.
 *
 * Composition follows the BRAND.md tone: Fraunces display heading,
 * Inter body, generous spacing, the coral accent reserved for the
 * single primary CTA. The decorative radial-gradient backdrop is a
 * v1 stand-in for the eventual product mockup (App Store
 * screenshot, video frame) — coral on dark, contained, not loud.
 *
 * Responsive type scale: 5xl (48px) on phone → 6xl (60px) on
 * tablet → 7xl (72px) on desktop. The display font's tight
 * tracking + `leading-[1.05]` keeps the multi-line headline
 * compact even at the largest size.
 *
 * Two CTAs:
 *   - Primary: "Découvrir Mony Pro" → /#pricing (anchor scroll)
 *   - Outline: "Télécharger l'app" → /#download (placeholder
 *     anchor; H.X swaps for real App Store / Play Store URLs
 *     once apps are published).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Radial gradient backdrop. Pure CSS, no asset dependency.
          The two layered gradients give a subtle off-center glow
          rather than a centered halo, which would compete with
          the headline's visual weight. */}
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
            Vendez. Découvrez.{' '}
            <span className="text-brand">Connectez-vous.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl">
            Mony est la marketplace vidéo qui rassemble créateurs,
            boutiques et collectionneurs. Achetez, vendez et faites
            grandir votre activité — dans une expérience pensée pour
            mobile.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a href="#pricing">
              <Button variant="primary" size="lg">
                Découvrir Mony Pro
              </Button>
            </a>
            <a href="#download">
              <Button variant="outline" size="lg">
                Télécharger l&apos;app
              </Button>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
