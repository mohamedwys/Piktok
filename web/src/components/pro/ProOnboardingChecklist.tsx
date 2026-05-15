'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { captureEvent } from '@/lib/posthog-client';
import type { ProOnboardingServerState } from '@/lib/pro/data';

/**
 * Pro onboarding checklist surfaced on the /pro home (Track 7, with
 * the Connect step retrofitted in F.C.4).
 *
 * Four visible rows after the welcome modal (Step 1 = subscribe,
 * already accomplished by virtue of being on /pro):
 *   Step 2 — Complete your seller profile
 *   Step 3 — Connect your Stripe account (NEW — F.C.4, NOT skippable)
 *   Step 4 — Activate Buy Now on your listings
 *   Step 5 — Boost your best listing
 * (Step 6, the dashboard tour, is handled by `ProDashboardTour`.)
 *
 * Step 4 is GATED on Step 3: the destination-charge flow (F.C.1) needs
 * Stripe charges enabled on the connected account, so Buy Now can't
 * actually function until Connect is done. When Step 3 is not done,
 * Step 4 renders disabled with a "Connect Stripe first" inline note
 * and the tap target is removed entirely.
 *
 * Cross-platform skip flags (intentionally NOT shared with mobile):
 *   Mobile uses MMKV (`mony.pro.step3Skipped` / `mony.pro.step4Skipped`).
 *   Web uses localStorage with the SAME key names.
 *   The keys are FROZEN at their pre-F.C.4 names — mobile still uses
 *   them under the legacy numbering, and renaming web-side would
 *   orphan existing user skips. The keys map to the new step numbers
 *   as follows:
 *     `mony.pro.step3Skipped` → skips Step 4 (Buy Now)
 *     `mony.pro.step4Skipped` → skips Step 5 (Boost)
 *   Step 3 (Connect) is NOT skippable — there is no Connect skip flag.
 *   We do NOT sync the two stores; "skip on this platform" is the
 *   right granularity given the surfaces are different enough.
 *
 * Visibility: returns null when all four steps are done (server +
 * skip merged). The parent Server Component still renders this
 * component unconditionally — letting the client decide whether to
 * paint avoids a hydration mismatch when the localStorage skip flags
 * change the visibility outcome between server and client.
 *
 * Telemetry:
 *   - `pro_checklist_step_started` on row tap (only when not done and
 *     not disabled).
 *   - `pro_checklist_step_completed` on the false→true transition for
 *     each step. Refs over the previous value so the event fires once
 *     per transition, not on every render.
 *   - `pro_checklist_step_skipped` on Skip tap.
 *   - `pro_checklist_completed` on the false→true transition of
 *     allDone.
 *
 * Note that the `{ step }` event property now matches the new UI
 * numbering — Buy Now is step 4 (was step 3 pre-F.C.4) and Boost is
 * step 5 (was step 4). PostHog funnels segmented by step number will
 * see a discontinuity at the F.C.4 cutover.
 *
 * The transition refs are seeded with the SERVER state (not the
 * merged state) on first render — so a user who landed with a
 * pre-existing skip flag does NOT immediately fire a "completed"
 * event for that step. Only genuine session-time transitions count.
 */
type StepNumber = 2 | 3 | 4 | 5;

const STEP4_SKIP_KEY = 'mony.pro.step3Skipped';
const STEP5_SKIP_KEY = 'mony.pro.step4Skipped';

export function ProOnboardingChecklist({
  initial,
}: {
  initial: ProOnboardingServerState;
}) {
  const t = useTranslations('pro.onboarding');
  const [step4Skipped, setStep4Skipped] = useState(false);
  const [step5Skipped, setStep5Skipped] = useState(false);
  const [skipsLoaded, setSkipsLoaded] = useState(false);

  // Hydrate skip flags from localStorage. We can't read storage on
  // the server, so the first render mirrors the server state (no
  // skips applied). The effect runs once on mount and snaps the
  // merged state into place — a brief flash if a step would have
  // been skipped, but no hydration mismatch.
  useEffect(() => {
    try {
      setStep4Skipped(window.localStorage.getItem(STEP4_SKIP_KEY) === '1');
      setStep5Skipped(window.localStorage.getItem(STEP5_SKIP_KEY) === '1');
    } catch {
      // localStorage may be blocked (private browsing on some
      // browsers, sandboxed iframes). Treat as "no skips applied".
    }
    setSkipsLoaded(true);
  }, []);

  const step2Done = initial.step2Done;
  const step3Done = initial.step3Done;
  const step4Done = initial.step4Done || step4Skipped;
  const step5Done = initial.step5Done || step5Skipped;
  const doneCount =
    (step2Done ? 1 : 0) +
    (step3Done ? 1 : 0) +
    (step4Done ? 1 : 0) +
    (step5Done ? 1 : 0);
  const allDone = doneCount === 4;

  const prevStep2 = useRef(initial.step2Done);
  const prevStep3 = useRef(initial.step3Done);
  const prevStep4 = useRef(initial.step4Done);
  const prevStep5 = useRef(initial.step5Done);
  const prevAllDone = useRef(
    initial.step2Done &&
      initial.step3Done &&
      initial.step4Done &&
      initial.step5Done,
  );

  useEffect(() => {
    if (!prevStep2.current && step2Done) {
      captureEvent('pro_checklist_step_completed', { step: 2 });
    }
    if (!prevStep3.current && step3Done) {
      captureEvent('pro_checklist_step_completed', { step: 3 });
    }
    if (!prevStep4.current && step4Done && !step4Skipped) {
      captureEvent('pro_checklist_step_completed', { step: 4 });
    }
    if (!prevStep5.current && step5Done && !step5Skipped) {
      captureEvent('pro_checklist_step_completed', { step: 5 });
    }
    if (!prevAllDone.current && allDone) {
      captureEvent('pro_checklist_completed');
    }
    prevStep2.current = step2Done;
    prevStep3.current = step3Done;
    prevStep4.current = step4Done;
    prevStep5.current = step5Done;
    prevAllDone.current = allDone;
  }, [
    step2Done,
    step3Done,
    step4Done,
    step5Done,
    allDone,
    step4Skipped,
    step5Skipped,
  ]);

  if (!skipsLoaded || allDone) return null;

  const handleStart = (step: StepNumber) => {
    captureEvent('pro_checklist_step_started', { step });
  };

  const handleSkip = (step: 4 | 5) => {
    try {
      window.localStorage.setItem(
        step === 4 ? STEP4_SKIP_KEY : STEP5_SKIP_KEY,
        '1',
      );
    } catch {
      // Storage unavailable — the skip won't persist across reloads,
      // but the in-memory state still hides the row this session.
    }
    if (step === 4) setStep4Skipped(true);
    else setStep5Skipped(true);
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
          {t('progressLabel', { done: doneCount, total: 4 })}
        </span>
      </header>

      <div className="mb-5 h-1 overflow-hidden rounded-pill bg-surface">
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-300"
          style={{ width: `${(doneCount / 4) * 100}%` }}
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
          href="/pro/payouts"
          onStart={() => handleStart(3)}
        />
        <ChecklistRow
          step={4}
          done={step4Done}
          title={t('step4Title')}
          body={t('step4Body')}
          href="/pro/products?mode=contact_only"
          onStart={() => handleStart(4)}
          skipLabel={t('step4Skip')}
          onSkip={() => handleSkip(4)}
          disabled={!step3Done}
          disabledNote={t('step4DisabledTooltip')}
        />
        <ChecklistRow
          step={5}
          done={step5Done}
          title={t('step5Title')}
          body={t('step5Body')}
          href="/pro/products"
          onStart={() => handleStart(5)}
          skipLabel={t('step5Skip')}
          onSkip={() => handleSkip(5)}
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
  disabled = false,
  disabledNote,
}: {
  step: StepNumber;
  done: boolean;
  title: string;
  body: string;
  href: string;
  onStart: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const isDisabled = !done && disabled;
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
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold ${
              isDisabled
                ? 'text-text-tertiary opacity-60'
                : 'text-text-secondary'
            }`}
          >
            {step}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold ${
            done
              ? 'text-text-secondary line-through'
              : isDisabled
                ? 'text-text-tertiary'
                : 'text-text-primary'
          }`}
        >
          {title}
        </div>
        <p
          className={`mt-1 text-sm ${
            isDisabled ? 'text-text-tertiary' : 'text-text-secondary'
          }`}
        >
          {body}
        </p>
        {isDisabled && disabledNote ? (
          <p className="mt-2 text-xs font-medium text-text-tertiary">
            {disabledNote}
          </p>
        ) : null}
        {!done && !isDisabled && skipLabel && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 text-xs font-medium text-text-tertiary underline-offset-2 hover:underline"
          >
            {skipLabel}
          </button>
        ) : null}
      </div>
      {done || isDisabled ? null : (
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
