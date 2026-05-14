'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { captureEvent } from '@/lib/posthog-client';
import type { ProOnboardingServerState } from '@/lib/pro/data';

/**
 * Pro onboarding checklist surfaced on the /pro home (Track 7).
 *
 * Web mirror of mobile's `ProOnboardingChecklist` (Track 6) — same
 * three steps (2/3/4 of the 5-step wizard, with Step 1 = subscribe
 * already accomplished by virtue of being on /pro and Step 5 =
 * dashboard tour handled by `ProDashboardTour`), same done-state
 * predicates, same skippability rules, same telemetry event names.
 *
 * Cross-platform skip flags (intentionally NOT shared):
 *   Mobile uses MMKV (`mony.pro.step3Skipped` / `mony.pro.step4Skipped`).
 *   Web uses localStorage with the SAME key names.
 *   We do NOT sync the two stores — a user who skips Step 3 on mobile
 *   would still see it on web, and vice versa. Sharing the flag would
 *   require a server round-trip per check, and the surfaces are
 *   different enough (mobile checklist is on profile, web is on /pro
 *   home) that "skip on this platform" is the right granularity.
 *
 * Visibility: returns null when all three steps are done (server +
 * skip merged). The parent Server Component still renders this
 * component unconditionally — letting the client decide whether to
 * paint avoids a hydration mismatch when the localStorage skip flags
 * change the visibility outcome between server and client.
 *
 * Telemetry:
 *   - `pro_checklist_step_started` on row tap (only when not done).
 *   - `pro_checklist_step_completed` on the false→true transition for
 *     each step. Refs over the previous value so the event fires once
 *     per transition, not on every render.
 *   - `pro_checklist_step_skipped` on Skip tap.
 *   - `pro_checklist_completed` on the false→true transition of
 *     allDone.
 *
 * The transition refs are seeded with the SERVER state (not the
 * merged state) on first render — so a user who landed with a
 * pre-existing skip flag does NOT immediately fire a "completed"
 * event for that step. Only genuine session-time transitions count.
 */
type StepNumber = 2 | 3 | 4;

const STEP3_SKIP_KEY = 'mony.pro.step3Skipped';
const STEP4_SKIP_KEY = 'mony.pro.step4Skipped';

export function ProOnboardingChecklist({
  initial,
}: {
  initial: ProOnboardingServerState;
}) {
  const t = useTranslations('pro.onboarding');
  const [step3Skipped, setStep3Skipped] = useState(false);
  const [step4Skipped, setStep4Skipped] = useState(false);
  const [skipsLoaded, setSkipsLoaded] = useState(false);

  // Hydrate skip flags from localStorage. We can't read storage on
  // the server, so the first render mirrors the server state (no
  // skips applied). The effect runs once on mount and snaps the
  // merged state into place — a brief flash if a step would have
  // been skipped, but no hydration mismatch.
  useEffect(() => {
    try {
      setStep3Skipped(window.localStorage.getItem(STEP3_SKIP_KEY) === '1');
      setStep4Skipped(window.localStorage.getItem(STEP4_SKIP_KEY) === '1');
    } catch {
      // localStorage may be blocked (private browsing on some
      // browsers, sandboxed iframes). Treat as "no skips applied".
    }
    setSkipsLoaded(true);
  }, []);

  const step2Done = initial.step2Done;
  const step3Done = initial.step3Done || step3Skipped;
  const step4Done = initial.step4Done || step4Skipped;
  const doneCount =
    (step2Done ? 1 : 0) + (step3Done ? 1 : 0) + (step4Done ? 1 : 0);
  const allDone = doneCount === 3;

  const prevStep2 = useRef(initial.step2Done);
  const prevStep3 = useRef(initial.step3Done);
  const prevStep4 = useRef(initial.step4Done);
  const prevAllDone = useRef(
    initial.step2Done && initial.step3Done && initial.step4Done,
  );

  useEffect(() => {
    if (!prevStep2.current && step2Done) {
      captureEvent('pro_checklist_step_completed', { step: 2 });
    }
    if (!prevStep3.current && step3Done && !step3Skipped) {
      captureEvent('pro_checklist_step_completed', { step: 3 });
    }
    if (!prevStep4.current && step4Done && !step4Skipped) {
      captureEvent('pro_checklist_step_completed', { step: 4 });
    }
    if (!prevAllDone.current && allDone) {
      captureEvent('pro_checklist_completed');
    }
    prevStep2.current = step2Done;
    prevStep3.current = step3Done;
    prevStep4.current = step4Done;
    prevAllDone.current = allDone;
  }, [step2Done, step3Done, step4Done, allDone, step3Skipped, step4Skipped]);

  if (!skipsLoaded || allDone) return null;

  const handleStart = (step: StepNumber) => {
    captureEvent('pro_checklist_step_started', { step });
  };

  const handleSkip = (step: 3 | 4) => {
    try {
      window.localStorage.setItem(
        step === 3 ? STEP3_SKIP_KEY : STEP4_SKIP_KEY,
        '1',
      );
    } catch {
      // Storage unavailable — the skip won't persist across reloads,
      // but the in-memory state still hides the row this session.
    }
    if (step === 3) setStep3Skipped(true);
    else setStep4Skipped(true);
    captureEvent('pro_checklist_step_skipped', { step });
  };

  return (
    <section
      aria-labelledby="pro-onboarding-heading"
      className="rounded-xl border border-border bg-surface-elevated p-5"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="pro-onboarding-heading"
          className="font-display text-lg font-semibold text-text-primary"
        >
          {t('heading')}
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          {t('progressLabel', { done: doneCount, total: 3 })}
        </span>
      </header>

      <div className="mb-5 h-1 overflow-hidden rounded-pill bg-surface">
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-300"
          style={{ width: `${(doneCount / 3) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <ul className="divide-y divide-border">
        <ChecklistRow
          step={2}
          done={step2Done}
          title={t('step2Title')}
          body={t('step2Body')}
          href="/pro/profile"
          onStart={() => handleStart(2)}
        />
        <ChecklistRow
          step={3}
          done={step3Done}
          title={t('step3Title')}
          body={t('step3Body')}
          href="/pro/products?mode=contact_only"
          onStart={() => handleStart(3)}
          skipLabel={t('step3Skip')}
          onSkip={() => handleSkip(3)}
        />
        <ChecklistRow
          step={4}
          done={step4Done}
          title={t('step4Title')}
          body={t('step4Body')}
          href="/pro/products"
          onStart={() => handleStart(4)}
          skipLabel={t('step4Skip')}
          onSkip={() => handleSkip(4)}
        />
      </ul>
    </section>
  );
}

function ChecklistRow({
  step,
  done,
  title,
  body,
  href,
  onStart,
  skipLabel,
  onSkip,
}: {
  step: StepNumber;
  done: boolean;
  title: string;
  body: string;
  href: string;
  onStart: () => void;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <li className="flex items-start gap-4 py-4">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2
            size={24}
            className="text-brand"
            aria-hidden="true"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-text-secondary">
            {step}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold ${
            done ? 'text-text-secondary line-through' : 'text-text-primary'
          }`}
        >
          {title}
        </div>
        <p className="mt-1 text-sm text-text-secondary">{body}</p>
        {!done && skipLabel && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 text-xs font-medium text-text-tertiary underline-offset-2 hover:underline"
          >
            {skipLabel}
          </button>
        ) : null}
      </div>
      {done ? null : (
        <Link
          href={href}
          onClick={onStart}
          aria-label={title}
          className="mt-1 shrink-0 text-text-secondary hover:text-text-primary"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}
