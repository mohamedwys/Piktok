import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * FAQ — accordion of seven common questions.
 *
 * Implementation: native `<details>` / `<summary>` rather than a
 * JS-driven accordion. Reasons:
 *   1. Server-renders fully — no client hydration cost, no JS
 *      bundle for accordion state.
 *   2. Better accessibility — keyboard-operable and
 *      screen-reader-aware out of the box.
 *   3. Better SEO — Google indexes the answer text even when the
 *      `<details>` is closed.
 *
 * The chevron rotation uses `group-open:rotate-180` (Tailwind's
 * `group-open` variant) — pure CSS, no JS state.
 *
 * Question copy comes from the locale catalog at `faq.q1`–`faq.q7`,
 * each with `q` + `a` keys. The seven question slots are constant
 * across locales; the answers translate per locale.
 */
const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] as const;

export async function FAQ() {
  const t = await getTranslations('faq');

  return (
    <Section id="faq">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            {t('heading')}
          </h2>

          <div className="mt-16">
            {QUESTION_KEYS.map((key) => (
              <details
                key={key}
                className="group border-b border-border py-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-xl font-semibold text-text-primary">
                    {t(`${key}.q`)}
                  </span>
                  <ChevronDown
                    className="shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180"
                    size={20}
                    aria-hidden
                  />
                </summary>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  {t(`${key}.a`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
