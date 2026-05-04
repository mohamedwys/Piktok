import { ChevronDown } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * FAQ — accordion of seven common questions.
 *
 * Implementation choice: native `<details>` / `<summary>` rather
 * than a JS-driven accordion. Three reasons:
 *   1. Server-renders fully — no client hydration cost, no
 *      JS bundle for accordion state.
 *   2. Better accessibility — `<details>` is keyboard-operable and
 *      screen-reader-aware out of the box.
 *   3. Better SEO — Google indexes the answer text even when the
 *      `<details>` is closed.
 *
 * The chevron rotation uses `group-open:rotate-180` (Tailwind's
 * `group-open` variant) — pure CSS, no JS state.
 */
type QA = { question: string; answer: string };

const QUESTIONS: QA[] = [
  {
    question: 'Comment puis-je commencer à vendre sur Mony ?',
    answer:
      'Téléchargez l’app, créez votre compte avec votre email, et publiez ' +
      'votre première annonce vidéo. Trente secondes suffisent.',
  },
  {
    question:
      'Quelle est la différence entre un compte gratuit et Mony Pro ?',
    answer:
      'Le compte gratuit limite à 10 annonces avec 7% de frais de ' +
      'transaction. Mony Pro offre des annonces illimitées, des frais ' +
      'réduits à 4%, une mise en avant hebdomadaire, et un tableau de ' +
      'bord analytics.',
  },
  {
    question: 'Comment fonctionne le paiement ?',
    answer:
      'Stripe gère toutes les transactions de manière sécurisée. Les ' +
      'vendeurs Pro reçoivent leurs paiements directement sur leur ' +
      'compte bancaire — sans intermédiaire et sans délai.',
  },
  {
    question: 'Puis-je annuler Mony Pro à tout moment ?',
    answer:
      'Oui, sans engagement. Vous gardez l’accès Pro jusqu’à la fin de ' +
      'votre période en cours, puis vous repassez automatiquement en ' +
      'compte gratuit.',
  },
  {
    question: 'Mony est-il disponible dans mon pays ?',
    answer:
      'Mony fonctionne partout. La devise s’adapte automatiquement à ' +
      'votre région (EUR, USD, AED, GBP…) et les transactions traversent ' +
      'les frontières sans friction.',
  },
  {
    question: 'Comment Mony protège-t-il ma vie privée ?',
    answer:
      'Nous ne vendons jamais vos données. Vos messages et transactions ' +
      'restent privés. Le détail complet est dans notre politique de ' +
      'confidentialité.',
  },
  {
    question: 'Comment contacter le support ?',
    answer:
      'Via le menu « Compte » dans l’app. Réponse moyenne en moins de ' +
      '24 heures, en français ou en anglais.',
  },
];

export function FAQ() {
  return (
    <Section id="faq">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
            Questions fréquentes
          </h2>

          <div className="mt-16">
            {QUESTIONS.map(({ question, answer }) => (
              <details
                key={question}
                className="group border-b border-border py-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-xl font-semibold text-text-primary">
                    {question}
                  </span>
                  <ChevronDown
                    className="shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180"
                    size={20}
                    aria-hidden
                  />
                </summary>
                <p className="mt-4 leading-relaxed text-text-secondary">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
