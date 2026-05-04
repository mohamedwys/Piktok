import { Globe, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * Features grid — four cards explaining what Mony is.
 *
 * Cards use `bg-surface-elevated` (the second elevation in the
 * dark stack) + a hairline `border-border` for the BRAND.md
 * elevation discipline (no shadows on dark; surface stack +
 * borders carry depth).
 *
 * Icons from lucide-react with the brand coral as their stroke
 * color — the only place outside of CTAs and active states where
 * the accent appears, and only in icon form (BRAND.md says
 * "Icons (any size)" is allowed on `colors.brand`).
 *
 * Copy in French; mirrors mobile's tone (direct, not corporate).
 */
type Feature = {
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    Icon: Zap,
    title: 'Vidéo first',
    body:
      'Chaque annonce commence par une vidéo qui capte l’attention. ' +
      'Vendez avec l’énergie d’un live, pas la friction d’un formulaire.',
  },
  {
    Icon: Globe,
    title: 'Local et mondial',
    body:
      'Filtrez par distance pour trouver près de chez vous, ou explorez ' +
      'les vendeurs partout dans le monde.',
  },
  {
    Icon: ShieldCheck,
    title: 'Paiement sécurisé',
    body:
      'Stripe gère toutes les transactions. Les vendeurs Pro encaissent ' +
      'directement sur leur compte bancaire.',
  },
  {
    Icon: Sparkles,
    title: 'Communauté',
    body:
      'Suivez vos vendeurs préférés. Recevez les nouveautés avant tout le ' +
      'monde, commentez, négociez en direct.',
  },
];

export function Features() {
  return (
    <Section id="features">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            Une marketplace pensée différemment
          </h2>
          <p className="mt-6 text-lg text-text-secondary">
            Quatre choses que Mony fait mieux.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface-elevated p-8"
            >
              <Icon className="text-brand" size={28} />
              <h3 className="mt-6 font-display text-2xl font-semibold text-text-primary">
                {title}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
