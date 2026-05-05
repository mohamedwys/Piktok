import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import { useFeatureProductMutation } from '@/features/marketplace/hooks/useFeatureProductMutation';
import { useUpgradeFlow } from '@/hooks/useUpgradeFlow';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { colors, spacing } from '@/theme';

const BOOST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type BoostButtonProps = {
  productId: string;
  /**
   * Current boost expiration of the listing (ISO-8601). When in the
   * future the listing is currently featured and the button shows the
   * "Featured ✓" disabled state.
   */
  featuredUntil: string | null;
  /**
   * Caller's `sellers.last_boost_at` (ISO-8601). When non-null and within
   * 7 days from now, the button shows the cooldown disabled state with
   * the next-available date. Pulled from `useMySeller` upstream.
   */
  lastBoostAt: string | null;
};

type BoostState =
  | { kind: 'loading' }
  | { kind: 'gate' }
  | { kind: 'featured'; until: Date }
  | { kind: 'cooldown'; nextAt: Date }
  | { kind: 'idle' };

function formatNextDate(d: Date, lang: string): string {
  // Use Intl.DateTimeFormat with the active app locale. RN ships ICU on
  // Android and full Intl on iOS post-Hermes; fall back to ISO for the
  // unlikely platform that lacks it.
  try {
    return new Intl.DateTimeFormat(lang, {
      day: '2-digit',
      month: 'short',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Pro-perk Boost button (H.12). Mounted by `ProductDetailSheet` ONLY on
 * the viewer's own listing (the parent decides — this component does not
 * itself check ownership; the SECURITY DEFINER RPC is the second line of
 * defense regardless).
 *
 * State machine (in priority order):
 *   1. Mutation in flight → spinner, button disabled.
 *   2. Caller is not Pro → label "Booster (Pro)", tap routes to the
 *      upgrade flow via `useUpgradeFlow` (same hook as the H.4 banners).
 *   3. Listing is currently featured (`featuredUntil > now()`) → label
 *      "À la une ✓", button disabled.
 *   4. Caller is in cooldown (`now < lastBoostAt + 7d`) → label "Prochain
 *      boost {date}", button disabled. The displayed date is the cooldown
 *      expiration (= last boost expiration since durations match).
 *   5. Default → label "Booster cette annonce". Tap fires a confirmation
 *      Alert; on confirm fires the mutation; on success shows a success
 *      Alert with the new expiration.
 *
 * Error mapping:
 *   - "not_pro"             → upgrade-flow CTA (UI guard already prevents
 *                              this in normal use; defense in depth).
 *   - "cooldown_active"     → cooldown error Alert. Should never happen
 *                              if the UI-side guard is correct, but the
 *                              clock might drift between client and
 *                              server.
 *   - anything else         → generic error Alert.
 */
export function BoostButton({
  productId,
  featuredUntil,
  lastBoostAt,
}: BoostButtonProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const isPro = useIsPro();
  const upgrade = useUpgradeFlow();
  const mutation = useFeatureProductMutation();

  const state: BoostState = useMemo(() => {
    if (mutation.isPending) return { kind: 'loading' };
    if (!isPro) return { kind: 'gate' };

    const now = Date.now();

    if (featuredUntil) {
      const until = new Date(featuredUntil);
      if (until.getTime() > now) return { kind: 'featured', until };
    }

    if (lastBoostAt) {
      const last = new Date(lastBoostAt).getTime();
      const nextAt = new Date(last + BOOST_COOLDOWN_MS);
      if (nextAt.getTime() > now) return { kind: 'cooldown', nextAt };
    }

    return { kind: 'idle' };
  }, [isPro, featuredUntil, lastBoostAt, mutation.isPending]);

  const onPress = (): void => {
    void mediumHaptic();

    if (state.kind === 'gate') {
      void upgrade();
      return;
    }
    if (state.kind !== 'idle') return;

    Alert.alert(
      t('boost.confirmTitle'),
      t('boost.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('boost.confirmAction'),
          onPress: () => {
            mutation.mutate(productId, {
              onSuccess: (data) => {
                const date = formatNextDate(
                  new Date(data.featured_until),
                  i18n.language,
                );
                Alert.alert(
                  t('boost.successTitle'),
                  t('boost.successBody', { date }),
                );
              },
              onError: (err) => {
                const msg = err.message ?? '';
                if (msg.includes('not_pro')) {
                  void upgrade();
                  return;
                }
                if (msg.includes('cooldown_active')) {
                  Alert.alert(
                    t('common.errorGeneric'),
                    t('boost.errorCooldown'),
                  );
                  return;
                }
                Alert.alert(
                  t('common.errorGeneric'),
                  t('boost.errorGeneric'),
                );
              },
            });
          },
        },
      ],
    );
  };

  const label = (() => {
    switch (state.kind) {
      case 'gate':
        return t('boost.buttonProGate');
      case 'featured':
        return t('boost.buttonFeatured');
      case 'cooldown':
        return t('boost.buttonCooldown', {
          date: formatNextDate(state.nextAt, i18n.language),
        });
      case 'loading':
      case 'idle':
      default:
        return t('boost.buttonIdle');
    }
  })();

  const isDisabled =
    state.kind === 'loading'
    || state.kind === 'featured'
    || state.kind === 'cooldown';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      <View style={styles.row}>
        {state.kind === 'loading' ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Ionicons
            name={state.kind === 'featured' ? 'sparkles' : 'sparkles-outline'}
            size={16}
            color={state.kind === 'gate' ? colors.brand : '#fff'}
          />
        )}
        <Text
          variant="body"
          weight="semibold"
          style={state.kind === 'gate' ? styles.gateText : styles.text}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  text: {
    color: '#fff',
  },
  gateText: {
    color: colors.brand,
  },
});

export default BoostButton;
