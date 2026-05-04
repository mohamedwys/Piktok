import { getTranslations } from 'next-intl/server';
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
 * The four feature keys (`videoFirst`, `localGlobal`,
 * `securePayments`, `community`) match across all three locale
 * catalogs; missing keys would fall back to the default locale.
 */
const FEATURES = [
  { Icon: Zap, key: 'videoFirst' },
  { Icon: Globe, key: 'localGlobal' },
  { Icon: ShieldCheck, key: 'securePayments' },
  { Icon: Sparkles, key: 'community' },
] as const;

export async function Features() {
  const t = await getTranslations('features');

  return (
    <Section id="features">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            {t('heading')}
          </h2>
          <p className="mt-6 text-lg text-text-secondary">{t('sub')}</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map(({ Icon, key }) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-surface-elevated p-8"
            >
              <Icon className="text-brand" size={28} />
              <h3 className="mt-6 font-display text-2xl font-semibold text-text-primary">
                {t(`${key}.title`)}
              </h3>
              <p className="mt-3 leading-relaxed text-text-secondary">
                {t(`${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
