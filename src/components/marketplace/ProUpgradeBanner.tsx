import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Chip, Pressable, Surface, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/**
 * Reusable Pro-tier upsell banner used by every non-Pro CTA surface in
 * Phase H.4 (sell-flow cap reminder, profile pitch, action-rail
 * checkout gate). The shape is intentionally generic — copy and
 * emphasis are passed as props so the same component can soft-pitch
 * ("Become a Pro seller") or urgently warn ("9 / 10 listings used").
 *
 * Visual emphasis:
 *   - 'soft'   → standard Surface border + outlined Chip CTA. The
 *                default; appropriate for passive pitches.
 *   - 'urgent' → coral border (1.5px, colors.brand) + filled Chip
 *                CTA. Triggered by the sell-flow banner when
 *                listing-cap remaining ≤ 2 (catches the user
 *                before they hit the wall).
 *
 * Dismissal: optional `onDismiss` renders an X button. The H.4
 * consumers wire this to the `useDismissedBanners` store so the
 * banner stays hidden for 24h. Banners with no `onDismiss` are
 * un-dismissable (no use case for that today, but the prop is
 * optional rather than required to keep the API minimal).
 */
export type ProUpgradeBannerEmphasis = 'soft' | 'urgent';

export type ProUpgradeBannerProps = {
  title: string;
  body?: string;
  ctaLabel: string;
  onPressCta: () => void;
  onDismiss?: () => void;
  emphasis?: ProUpgradeBannerEmphasis;
  /**
   * Optional leading icon — when omitted, a sparkle Ionicon is used
   * (sparkles for soft, sparkles-sharp for urgent → subtle visual
   * shift that pairs with the border-color shift).
   */
  leadingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProUpgradeBanner({
  title,
  body,
  ctaLabel,
  onPressCta,
  onDismiss,
  emphasis = 'soft',
  leadingIcon,
  style,
}: ProUpgradeBannerProps): React.ReactElement {
  const { t } = useTranslation();
  const isUrgent = emphasis === 'urgent';

  const defaultIcon = (
    <Ionicons
      name={isUrgent ? 'sparkles' : 'sparkles-outline'}
      size={22}
      color={isUrgent ? colors.brand : colors.text.primary}
    />
  );

  const urgentBorder: ViewStyle | undefined = isUrgent
    ? { borderColor: colors.brand, borderWidth: 1.5 }
    : undefined;

  return (
    <Surface
      variant="surfaceElevated"
      radius="lg"
      padding="md"
      border
      style={[urgentBorder, style]}
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>{leadingIcon ?? defaultIcon}</View>

        <View style={styles.copyCol}>
          <Text variant="body" weight="semibold" numberOfLines={2}>
            {title}
          </Text>
          {body ? (
            <Text
              variant="caption"
              color="secondary"
              style={styles.bodyText}
              numberOfLines={3}
            >
              {body}
            </Text>
          ) : null}
        </View>

        {onDismiss ? (
          <Pressable
            haptic="light"
            hitSlop={spacing.sm}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            style={styles.dismissBtn}
          >
            <Ionicons
              name="close"
              size={16}
              color={colors.text.tertiary}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.ctaRow}>
        <Chip
          label={ctaLabel}
          variant={isUrgent ? 'filled' : 'outlined'}
          size="sm"
          onPress={onPressCta}
          accessibilityLabel={ctaLabel}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    paddingTop: 2,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bodyText: {
    marginTop: 2,
    lineHeight: 18,
  },
  dismissBtn: {
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  ctaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

export default ProUpgradeBanner;
