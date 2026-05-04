import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * Pricing — single Pro tier card.
 *
 * The H roadmap commits to one tier (PRO_AUDIT.md committed
 * defaults: €19/mo or €190/yr placeholder, ~17% annual discount).
 * Numbers are deliberately placeholders pending user confirmation
 * — when the final price lands, edit the two strings below.
 *
 * The CTA does NOT link to /upgrade. /upgrade is auth-gated
 * (H.6's redirect-to-/ if unauth'd would just bounce anonymous
 * landing visitors back to here, creating a confusing loop). The
 * correct path to upgrade is via the mobile app's "Passer Pro"
 * affordance, which routes through H.5's magic-link flow and
 * lands the user authenticated. The CTA copy + subcaption make
 * this explicit so visitors aren't guessing.
 *
 * App Store / Play Store badges are placeholders pointing to
 * "#download" — H.X swaps for real URLs once the apps are
 * published. Showing them here today communicates "this is a
 * mobile-first product" even before the apps ship.
 */
const FEATURES: string[] = [
  'Annonces illimitées (10 max en gratuit)',
  'Frais de transaction réduits (~4% vs 7%)',
  'Mise en avant : 1 annonce boostée par semaine',
  'Tableau de bord analytics',
  'Badge PRO sur votre profil',
];

export function Pricing() {
  return (
    <Section id="pricing">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            Devenez vendeur Pro
          </h2>
          <p className="mt-6 text-lg text-text-secondary">
            Un tarif simple. Sans engagement. Annulez à tout moment.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-lg">
          <div className="relative rounded-xl border border-brand bg-surface-elevated p-10">
            <span className="absolute -top-3 left-10 inline-flex items-center rounded-pill bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-text">
              Recommandé
            </span>

            <h3 className="font-display text-3xl font-semibold text-text-primary">
              Mony Pro
            </h3>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold leading-none text-text-primary">
                19 €
              </span>
              <span className="text-base text-text-secondary">/ mois</span>
            </div>
            <p className="mt-2 text-sm italic text-text-tertiary">
              ou 190 € / an (économisez ~17%)
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 shrink-0 text-brand"
                    size={20}
                    aria-hidden
                  />
                  <span className="text-text-primary">{feature}</span>
                </li>
              ))}
            </ul>

            <a href="#download" className="mt-10 block">
              <Button variant="primary" size="lg" className="w-full">
                Commencer dans l&apos;app
              </Button>
            </a>
            <p className="mt-4 text-center text-sm text-text-secondary">
              Ouvrez l&apos;app Mony et touchez{' '}
              <span className="font-medium text-text-primary">
                « Passer Pro »
              </span>{' '}
              dans votre profil.
            </p>
          </div>

          {/* Placeholder store badges — the real App Store / Play
              Store URLs land in a follow-up step once the apps are
              published. Until then they anchor to #download which
              has no target; the CTA copy carries the "open the
              app" message regardless. */}
          <div
            id="download"
            className="mt-10 flex items-center justify-center gap-4"
          >
            <div className="rounded-md border border-border bg-surface px-5 py-3 text-center text-xs text-text-tertiary">
              App Store
              <br />
              <span className="text-text-secondary">Bientôt</span>
            </div>
            <div className="rounded-md border border-border bg-surface px-5 py-3 text-center text-xs text-text-tertiary">
              Google Play
              <br />
              <span className="text-text-secondary">Bientôt</span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
