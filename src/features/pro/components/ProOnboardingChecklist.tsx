import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, Surface, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { captureEvent } from '@/lib/posthog';
import { WEB_BASE_URL } from '@/lib/web/constants';
import { useProOnboardingState } from '@/features/pro/hooks/useProOnboardingState';
import {
  useProOnboardingSkips,
  type SkippableStep,
} from '@/stores/useProOnboardingSkips';

type StepNumber = 2 | 3 | 4 | 5;

type RowProps = {
  step: StepNumber;
  done: boolean;
  title: string;
  body: string;
  showSkip: boolean;
  skipLabel?: string;
  onPress: () => void;
  onSkip?: () => void;
  disabled?: boolean;
  disabledCaption?: string;
};

function ChecklistRow({
  step,
  done,
  title,
  body,
  showSkip,
  skipLabel,
  onPress,
  onSkip,
  disabled = false,
  disabledCaption,
}: RowProps): React.ReactElement {
  const isInert = done || disabled;
  return (
    <Pressable
      onPress={onPress}
      haptic={isInert ? undefined : 'light'}
      pressScale={isInert ? 1 : 0.98}
      style={[styles.row, disabled && !done ? styles.rowDisabled : null]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={isInert}
    >
      <View style={styles.rowLeft}>
        {done ? (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={colors.brand}
          />
        ) : (
          <View style={styles.numberChip}>
            <Text variant="caption" weight="bold" style={styles.numberChipText}>
              {step}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.rowMiddle}>
        <Text
          variant="body"
          weight="semibold"
          style={done ? styles.rowTitleDone : undefined}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          color="secondary"
          style={styles.rowBody}
          numberOfLines={2}
        >
          {body}
        </Text>
        {disabled && !done && disabledCaption ? (
          <Text
            variant="caption"
            color="tertiary"
            style={styles.disabledCaption}
            numberOfLines={1}
          >
            {disabledCaption}
          </Text>
        ) : null}
        {!disabled && showSkip && skipLabel && onSkip ? (
          <Pressable
            onPress={onSkip}
            haptic="light"
            hitSlop={8}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel={skipLabel}
          >
            <Text variant="caption" color="tertiary" style={styles.skipText}>
              {skipLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!isInert ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.text.tertiary}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * Post-IAP onboarding checklist rendered on the profile screen.
 *
 * Visible only when the user is Pro and at least one of Steps 2–5 is
 * still outstanding. Each row's done-state is derived in
 * `useProOnboardingState` from existing data (seller bio +
 * locationText, seller stripeChargesEnabled, products purchase_mode,
 * seller lastBoostAt) plus per-step MMKV skip flags. Steps 4 (Buy
 * Now) and 5 (Boost) are skippable; Step 2 (profile) and Step 3
 * (Connect Stripe) are not.
 *
 * Step 3 (F.C.6 retrofit) deep-links to the web /pro/payouts page
 * via WebBrowser — Stripe Connect onboarding lives on web and the
 * webhook updates `stripeChargesEnabled` on the seller row, which
 * flips this row to done on the next refetch.
 *
 * Step 4 (Buy Now) is gated on Step 3 (Connect): if Connect isn't
 * done yet the row renders disabled with a "Complete Connect first"
 * caption — the server-side checkout function already refuses
 * non-Connected sellers, so this is purely seller-side UX.
 *
 * Telemetry transitions are observed via refs over the previous
 * done-state so a step completion fires exactly once per transition,
 * not on every render.
 */
export function ProOnboardingChecklist(): React.ReactElement | null {
  const { t } = useTranslation();
  const router = useRouter();
  const state = useProOnboardingState();
  const skipStep = useProOnboardingSkips((s) => s.skipStep);

  const prevStep2 = useRef(state.step2Done);
  const prevStep3 = useRef(state.step3Done);
  const prevStep4 = useRef(state.step4Done);
  const prevStep5 = useRef(state.step5Done);
  const prevAllDone = useRef(state.allDone);

  useEffect(() => {
    if (!prevStep2.current && state.step2Done) {
      captureEvent('pro_checklist_step_completed', { step: 2 });
    }
    if (!prevStep3.current && state.step3Done) {
      captureEvent('pro_checklist_step_completed', { step: 3 });
    }
    if (!prevStep4.current && state.step4Done) {
      captureEvent('pro_checklist_step_completed', { step: 4 });
    }
    if (!prevStep5.current && state.step5Done) {
      captureEvent('pro_checklist_step_completed', { step: 5 });
    }
    if (!prevAllDone.current && state.allDone) {
      captureEvent('pro_checklist_completed');
    }
    prevStep2.current = state.step2Done;
    prevStep3.current = state.step3Done;
    prevStep4.current = state.step4Done;
    prevStep5.current = state.step5Done;
    prevAllDone.current = state.allDone;
  }, [
    state.step2Done,
    state.step3Done,
    state.step4Done,
    state.step5Done,
    state.allDone,
  ]);

  if (!state.visible) return null;

  const doneCount =
    (state.step2Done ? 1 : 0)
    + (state.step3Done ? 1 : 0)
    + (state.step4Done ? 1 : 0)
    + (state.step5Done ? 1 : 0);

  const goToEditProfile = (): void => {
    if (state.step2Done) return;
    captureEvent('pro_checklist_step_started', { step: 2 });
    router.push('/(protected)/edit-seller-profile');
  };

  const goToConnect = (): void => {
    if (state.step3Done) return;
    captureEvent('pro_checklist_step_started', { step: 3 });
    void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/pro/payouts`);
  };

  const goToMyListings = (step: 4 | 5) => (): void => {
    if (step === 4 && (state.step4Done || !state.step3Done)) return;
    if (step === 5 && state.step5Done) return;
    captureEvent('pro_checklist_step_started', { step });
    router.push('/(protected)/(tabs)/profile');
  };

  const handleSkip = (step: SkippableStep, telemetryStep: 4 | 5) => (): void => {
    captureEvent('pro_checklist_step_skipped', { step: telemetryStep });
    skipStep(step);
  };

  return (
    <Surface
      variant="surfaceElevated"
      radius="lg"
      padding="md"
      border
      accessibilityRole="summary"
    >
      <View style={styles.header}>
        <Text variant="body" weight="semibold">
          {t('pro.onboarding.title')}
        </Text>
        <Text variant="caption" color="secondary" weight="semibold">
          {t('pro.onboarding.progressLabel', { done: doneCount, total: 4 })}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.max(0, Math.min(1, state.progress)) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.rows}>
        <ChecklistRow
          step={2}
          done={state.step2Done}
          title={t('pro.onboarding.step2.title')}
          body={t('pro.onboarding.step2.body')}
          showSkip={false}
          onPress={goToEditProfile}
        />
        <View style={styles.rowDivider} />
        <ChecklistRow
          step={3}
          done={state.step3Done}
          title={t('pro.onboarding.step3.title')}
          body={t('pro.onboarding.step3.body')}
          showSkip={false}
          onPress={goToConnect}
        />
        <View style={styles.rowDivider} />
        <ChecklistRow
          step={4}
          done={state.step4Done}
          title={t('pro.onboarding.step4.title')}
          body={t('pro.onboarding.step4.body')}
          showSkip
          skipLabel={t('pro.onboarding.step4.skip')}
          onPress={goToMyListings(4)}
          onSkip={handleSkip('step4', 4)}
          disabled={!state.step3Done}
          disabledCaption={t('pro.onboarding.step4.disabledCaption')}
        />
        <View style={styles.rowDivider} />
        <ChecklistRow
          step={5}
          done={state.step5Done}
          title={t('pro.onboarding.step5.title')}
          body={t('pro.onboarding.step5.body')}
          showSkip
          skipLabel={t('pro.onboarding.step5.skip')}
          onPress={goToMyListings(5)}
          onSkip={handleSkip('step5', 5)}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceOverlay,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
  },
  rows: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitleDone: {
    color: colors.text.secondary,
  },
  rowBody: {
    lineHeight: 18,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  numberChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberChipText: {
    color: colors.text.secondary,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  skipText: {
    textDecorationLine: 'underline',
  },
  disabledCaption: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});

export default ProOnboardingChecklist;
