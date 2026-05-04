import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { getCurrency } from '@/i18n/getCurrency';

/**
 * Pricing — single Pro tier card, multi-currency (H.7.3).
 *
 * Three currencies for v1: EUR (default), USD, AED. Prices are
 * per-currency-authored — no live FX conversion. Each currency
 * has its own price/cadence/savings strings under
 * `pricing.<currency>` in the message catalogs; the locale-shared
 * shell (heading, recommended, features, CTA, subcopy) lives at
 * the flat `pricing.*` namespace.
 *
 * Currency resolution priority (per `getCurrency()`):
 *   1. NEXT_CURRENCY cookie (CurrencyPicker writes this).
 *   2. Accept-Language country tag → currency mapping.
 *   3. Default EUR.
 *
 * The component is a Server Component — currency is resolved at
 * request time from cookies + headers, so this page is now
 * dynamic-rendered (was static-rendered in H.7.1). That's the
 * correct shape for a per-visitor pricing display; static would
 * require ISR per (locale × currency) combination, which is
 * over-engineered for the H.7.3 scope.
 *
 * The yearly note composes via the shared `yearlyTemplate` key
 * with three substitutions (price / cadence / savings) drawn
 * from the per-currency subtree. This keeps the "or" preposition
 * + parens in the locale-aware shell while the numbers stay
 * currency-aware. For example:
 *   - EN + EUR: "or €190 / year (save 17%)"
 *   - FR + AED: "ou AED 749 / an (économisez 21%)"
 *   - AR + USD: "أو 19 $ / سنوياً (وفِّر 17%)"
 *
 * The CTA does NOT link to /upgrade. /upgrade is auth-gated; an
 * anonymous landing visitor would bounce to /. The subcopy +
 * placeholder store badges direct visitors to upgrade from the
 * mobile app instead.
 */
const FEATURE_KEYS = [
  'feature1',
  'feature2',
  'feature3',
  'feature4',
  'feature5',
] as const;

export async function Pricing() {
  const currency = await getCurrency();
  const t = await getTranslations('pricing');
  const tCurrency = await getTranslations(`pricing.${currency}`);

  const yearlyNote = t('yearlyTemplate', {
    price: tCurrency('priceYearly'),
    cadence: tCurrency('cadenceYearly'),
    savings: tCurrency('savings'),
  });

  return (
    <Section id="pricing">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            {t('heading')}
          </h2>
          <p className="mt-6 text-lg text-text-secondary">{t('sub')}</p>
        </div>

        <div className="mx-auto mt-16 max-w-lg">
          <div className="relative rounded-xl border border-brand bg-surface-elevated p-10">
            <span className="absolute -top-3 start-10 inline-flex items-center rounded-pill bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-text">
              {t('recommended')}
            </span>

            <h3 className="font-display text-3xl font-semibold text-text-primary">
              {t('tierName')}
            </h3>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold leading-none text-text-primary">
                {tCurrency('priceMonthly')}
              </span>
              <span className="text-base text-text-secondary">
                {tCurrency('cadenceMonthly')}
              </span>
            </div>
            <p className="mt-2 text-sm italic text-text-tertiary">
              {yearlyNote}
            </p>

            <ul className="mt-8 space-y-4">
              {FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <Check
                    className="mt-0.5 shrink-0 text-brand"
                    size={20}
                    aria-hidden
                  />
                  <span className="text-text-primary">{t(key)}</span>
                </li>
              ))}
            </ul>

            <a href="#download" className="mt-10 block">
              <Button variant="primary" size="lg" className="w-full">
                {t('cta')}
              </Button>
            </a>
            <p className="mt-4 text-center text-sm text-text-secondary">
              {t('subcopyPrefix')}
              <span className="font-medium text-text-primary">
                {t('subcopyHighlight')}
              </span>
              {t('subcopySuffix')}
            </p>
          </div>

          {/* Placeholder store badges. Anchored at #download so
              the Pricing CTA scroll-targets here. Real App Store /
              Play Store URLs land in a follow-up step once the
              apps publish. */}
          <div
            id="download"
            className="mt-10 flex items-center justify-center gap-4"
          >
            <div className="rounded-md border border-border bg-surface px-5 py-3 text-center text-xs text-text-tertiary">
              App Store
              <br />
              <span className="text-text-secondary">{t('comingSoon')}</span>
            </div>
            <div className="rounded-md border border-border bg-surface px-5 py-3 text-center text-xs text-text-tertiary">
              Google Play
              <br />
              <span className="text-text-secondary">{t('comingSoon')}</span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
