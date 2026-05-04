import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { useDisplayCurrency } from '@/stores/useDisplayCurrency';

const QUICK_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;

/**
 * Currency picker for the profile settings card. Mirrors the
 * language-toggle pattern at `profile.tsx:576` — same pill
 * shape, same active/inactive treatment — but renders the row
 * inside a horizontal ScrollView so the 5 pills (Auto + 4
 * currencies) don't clip on narrow devices.
 *
 * The "Auto" pill displays the detected currency inline
 * ("Auto · EUR" / "Auto · AED") so the user can see what was
 * detected without leaving the screen. Tapping it re-runs
 * detection via `setAuto()`.
 *
 * The 4 quick currencies cover the bulk of expected users
 * (EUR/USD/GBP for Europe + transatlantic, AED for the Gulf
 * marketplace). A fuller "More currencies..." sheet covering
 * the remaining ~200 supported codes is v2 polish — out of
 * scope for H'.3.
 */
export function CurrencyPicker(): React.ReactElement {
  const { t } = useTranslation();
  const currency = useDisplayCurrency((s) => s.currency);
  const source = useDisplayCurrency((s) => s.source);
  const setManual = useDisplayCurrency((s) => s.setManual);
  const setAuto = useDisplayCurrency((s) => s.setAuto);

  const isAutoActive = source === 'auto';
  const autoLabel = isAutoActive
    ? `${t('profile.currencyAuto')} · ${currency}`
    : t('profile.currencyAuto');

  return (
    <View style={styles.row}>
      <Text variant="body" weight="semibold">
        {t('profile.currencyLabel')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        <Pressable
          onPress={setAuto}
          haptic="light"
          style={[
            styles.pill,
            isAutoActive ? styles.pillActive : styles.pillInactive,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: isAutoActive }}
        >
          <Text
            style={[
              styles.pillText,
              isAutoActive ? styles.pillTextActive : styles.pillTextInactive,
            ]}
          >
            {autoLabel}
          </Text>
          {isAutoActive ? (
            <Ionicons
              name="checkmark"
              size={14}
              color={colors.brandText}
              style={styles.pillIcon}
            />
          ) : null}
        </Pressable>

        {QUICK_CURRENCIES.map((code) => {
          const isActive = source === 'manual' && currency === code;
          return (
            <Pressable
              key={code}
              onPress={() => setManual(code)}
              haptic="light"
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {code}
              </Text>
              {isActive ? (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={colors.brandText}
                  style={styles.pillIcon}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default CurrencyPicker;

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pillActive: {
    backgroundColor: colors.brand,
  },
  pillInactive: {
    backgroundColor: colors.surfaceOverlay,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.brandText,
    fontWeight: '700',
  },
  pillTextInactive: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  pillIcon: {
    marginLeft: spacing.xs,
  },
});
