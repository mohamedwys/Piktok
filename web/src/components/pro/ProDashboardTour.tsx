'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { captureEvent } from '@/lib/posthog-client';

/**
 * Inline /pro home tour — Step 5 of the Pro onboarding wizard
 * (Track 7).
 *
 * No third-party tour library by design (the brief forbids new web
 * deps): five tooltips anchored to known elements via
 * `[data-tour="…"]` selectors, sequenced through with Next/Done
 * controls. The selectors are wired in `ProTabs.tsx` and
 * `HomeKpiTiles.tsx` rather than passed in as props so adding/
 * removing a tour step here doesn't ripple into unrelated component
 * APIs.
 *
 * Lifecycle:
 *   - On mount: read `mony.pro.tourCompletedAt` from localStorage.
 *     If already set, this component renders null forever.
 *   - Otherwise: emit `pro_dashboard_tour_started` and start at
 *     step 0.
 *   - Each step measures the target element's bounding rect and
 *     positions the tooltip beneath it (or above if the target is
 *     in the lower half of the viewport — keeps the tooltip
 *     on-screen for tab-bar steps).
 *   - On Done / Skip / final Next: write `tourCompletedAt` to
 *     localStorage, emit `pro_dashboard_tour_completed`, and
 *     unmount.
 *
 * Resilience:
 *   - If a target element is missing (e.g., the Analytics tab is
 *     flagged off so its data-tour anchor doesn't exist), the
 *     component skips that step automatically. We don't fail-loud
 *     because the tour shouldn't break the dashboard.
 *   - On scroll/resize the position recalculates via the same
 *     measurement effect (deps include the step index + a
 *     `recomputeKey`).
 *
 * Why useLayoutEffect for measurement: the rect read must happen
 * after layout but before paint to avoid a one-frame flash of an
 * unpositioned tooltip. useEffect would paint at (0,0) for one
 * frame.
 */
const TOUR_COMPLETED_KEY = 'mony.pro.tourCompletedAt';

type TourStep = {
  selector: string;
  copyKey: 'step1' | 'step2' | 'step3' | 'step4' | 'step5';
};

const STEPS: TourStep[] = [
  { selector: '[data-tour="tabs"]', copyKey: 'step1' },
  { selector: '[data-tour="kpi-revenue"]', copyKey: 'step2' },
  { selector: '[data-tour="tab-products"]', copyKey: 'step3' },
  { selector: '[data-tour="tab-orders"]', copyKey: 'step4' },
  { selector: '[data-tour="tab-analytics"]', copyKey: 'step5' },
];

type TooltipPosition = {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom';
};

export function ProDashboardTour() {
  const t = useTranslations('pro.tour');
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [recomputeKey, setRecomputeKey] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    let alreadyDone = false;
    try {
      alreadyDone =
        window.localStorage.getItem(TOUR_COMPLETED_KEY) !== null;
    } catch {
      // Storage unavailable — treat as never-completed; the tour
      // will run but won't persist its completion. Acceptable for
      // private-browsing edge case.
    }
    if (alreadyDone) return;
    setActive(true);
    if (!startedRef.current) {
      startedRef.current = true;
      captureEvent('pro_dashboard_tour_started');
    }
  }, []);

  // Recompute on scroll / resize so the tooltip tracks its anchor
  // when the user adjusts the viewport mid-tour.
  useEffect(() => {
    if (!active) return undefined;
    const onChange = () => setRecomputeKey((k) => k + 1);
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [active]);

  // Auto-skip steps whose target element is absent in the DOM (e.g.
  // an analytics tab that's hidden behind a feature flag). Done in
  // an effect so the skip can chain through multiple missing
  // anchors in one render cycle.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    const target = document.querySelector(step.selector);
    if (target) return;
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, recomputeKey]);

  useLayoutEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    const target = document.querySelector(step.selector);
    if (!target) {
      setPosition(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const viewportH =
      window.innerHeight || document.documentElement.clientHeight;
    // Place the tooltip below the anchor unless the anchor sits in
    // the lower 40% of the viewport — then flip above so the
    // tooltip stays on-screen.
    const placeBelow = rect.bottom < viewportH * 0.6;
    const top = placeBelow ? rect.bottom + 12 : rect.top - 12;
    const left = Math.max(
      16,
      Math.min(rect.left + rect.width / 2, window.innerWidth - 16),
    );
    setPosition({
      top,
      left,
      arrowSide: placeBelow ? 'top' : 'bottom',
    });
  }, [active, stepIndex, recomputeKey]);

  const finish = () => {
    try {
      window.localStorage.setItem(
        TOUR_COMPLETED_KEY,
        String(Date.now()),
      );
    } catch {
      // Storage unavailable — completion event still fires so the
      // funnel records it, but the user will see the tour again
      // next visit. Same posture as the skip-flag fallback in
      // ProOnboardingChecklist.
    }
    captureEvent('pro_dashboard_tour_completed');
    setActive(false);
  };

  if (!active || !position) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;
  const isLast = stepIndex === STEPS.length - 1;

  const tooltipTransform =
    position.arrowSide === 'top'
      ? 'translate(-50%, 0)'
      : 'translate(-50%, -100%)';

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[60]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-live="polite"
        className="pointer-events-auto fixed z-[70] w-72 max-w-[calc(100vw-32px)] rounded-xl border border-border bg-surface-elevated p-4 shadow-lg"
        style={{
          top: position.top,
          left: position.left,
          transform: tooltipTransform,
        }}
      >
        <p className="text-sm text-text-primary">{t(step.copyKey)}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-text-tertiary underline-offset-2 hover:underline"
          >
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setStepIndex((i) => i + 1);
            }}
            className="rounded-pill bg-brand px-4 py-1.5 text-sm font-semibold text-brand-text hover:bg-brand-pressed"
          >
            {isLast ? t('done') : t('next')}
          </button>
        </div>
      </div>
    </>
  );
}
