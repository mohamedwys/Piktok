import React, { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Surface, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { captureEvent } from '@/lib/posthog';

export type ProWelcomeModalProps = {
  visible: boolean;
  onClose: () => void;
  onPrimaryCta: () => void;
};

type FeatureCard = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  titleKey: string;
  bodyKey: string;
};

const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    icon: 'sparkles-outline',
    titleKey: 'pro.welcome.card1Title',
    bodyKey: 'pro.welcome.card1Body',
  },
  {
    icon: 'bar-chart-outline',
    titleKey: 'pro.welcome.card2Title',
    bodyKey: 'pro.welcome.card2Body',
  },
  {
    icon: 'card-outline',
    titleKey: 'pro.welcome.card3Title',
    bodyKey: 'pro.welcome.card3Body',
  },
];

/**
 * Post-IAP welcome modal — Step 1 of the 5-step Pro onboarding wizard.
 *
 * Always-shown-after-purchase but dismissible. Two CTAs:
 *   - Primary "Set up my profile" routes to edit-seller-profile.
 *   - Secondary "Maybe later" closes silently.
 *
 * Triggered by `useProWelcome.show()` (called from useUpgradeFlow after
 * the IAP receipt validates and the subscription cache invalidates).
 * Visibility is controlled by the parent host component; this view is
 * presentational and stateless.
 *
 * Visual idiom follows NotificationOptInModal — full-screen scrim +
 * centered Surface card — to match the existing onboarding moments.
 */
export function ProWelcomeModal({
  visible,
  onClose,
  onPrimaryCta,
}: ProWelcomeModalProps): React.ReactElement {
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) captureEvent('pro_welcome_shown');
  }, [visible]);

  const handlePrimary = (): void => {
    captureEvent('pro_welcome_cta_clicked');
    onPrimaryCta();
  };

  const handleSecondary = (): void => {
    captureEvent('pro_welcome_skipped');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleSecondary}
    >
      <View style={styles.backdrop}>
        <Surface
          variant="surfaceElevated"
          radius="xxl"
          padding="xl"
          style={styles.card}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={28} color={colors.brand} />
          </View>
          <Text variant="title" weight="bold" style={styles.title}>
            {t('pro.welcome.title')}
          </Text>
          <Text variant="body" color="secondary" style={styles.subhead}>
            {t('pro.welcome.subhead')}
          </Text>

          <View style={styles.cardsRow}>
            {FEATURE_CARDS.map((card) => (
              <View key={card.titleKey} style={styles.featureCard}>
                <Ionicons
                  name={card.icon}
                  size={20}
                  color={colors.brand}
                />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={styles.featureTitle}
                  numberOfLines={1}
                >
                  {t(card.titleKey)}
                </Text>
                <Text
                  variant="caption"
                  color="secondary"
                  style={styles.featureBody}
                  numberOfLines={3}
                >
                  {t(card.bodyKey)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handlePrimary}
              haptic="medium"
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel={t('pro.welcome.primaryCta')}
            >
              <Text variant="body" weight="semibold" style={styles.primaryText}>
                {t('pro.welcome.primaryCta')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSecondary}
              haptic="light"
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel={t('pro.welcome.secondaryCta')}
            >
              <Text variant="body" weight="semibold" color="secondary">
                {t('pro.welcome.secondaryCta')}
              </Text>
            </Pressable>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'stretch',
    gap: spacing.md,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  subhead: {
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  featureCard: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureTitle: {
    marginTop: 2,
  },
  featureBody: {
    lineHeight: 16,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.brandText,
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
});

export default ProWelcomeModal;
