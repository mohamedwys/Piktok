import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { Pressable, Surface, Text } from '@/components/ui';
import { CATEGORIES } from '@/features/marketplace/data/categories';
import { getCategoryIcon } from '@/features/categories/icons';
import { getLocalized } from '@/i18n/getLocalized';
import {
  useMySeller,
  MY_SELLER_KEY,
} from '@/features/marketplace/hooks/useMySeller';
import { setMyInterests } from '@/features/marketplace/services/sellers';
import { captureEvent } from '@/lib/posthog';
import { useAuthStore } from '@/stores/useAuthStore';
import { toast } from '@/shared/ui/toast';
import { colors, radii, spacing } from '@/theme';
import {
  NotificationOptInModal,
  isOptInRecentlyDeclined,
} from '@/features/notifications/components/NotificationOptInModal';

const MIN = 3;
const MAX = 5;
const ICON_SIZE = 28;

type CategoryCellProps = {
  id: string;
  label: string;
  selected: boolean;
  onPress: () => void;
};

function CategoryCell({
  id,
  label,
  selected,
  onPress,
}: CategoryCellProps): React.ReactElement {
  const icon = getCategoryIcon(id);
  const iconColor = selected ? colors.brand : colors.text.primary;
  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.cellPress}
    >
      <Surface
        variant="surfaceElevated"
        radius="lg"
        style={[styles.cellSurface, selected && styles.cellSurfaceSelected]}
      >
        {icon.lib === 'Ionicons' ? (
          <Ionicons
            name={icon.name as React.ComponentProps<typeof Ionicons>['name']}
            size={ICON_SIZE}
            color={iconColor}
          />
        ) : (
          <MaterialCommunityIcons
            name={
              icon.name as React.ComponentProps<
                typeof MaterialCommunityIcons
              >['name']
            }
            size={ICON_SIZE}
            color={iconColor}
          />
        )}
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {label}
        </Text>
        {selected ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color={colors.brandText} />
          </View>
        ) : null}
      </Surface>
    </Pressable>
  );
}

export default function Onboarding(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ edit?: string }>();
  const editMode = params.edit === '1';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mySellerQuery = useMySeller(isAuthenticated);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const seededRef = useRef(false);

  // Seed selection from the existing interests exactly once when the seller
  // row arrives (edit mode only). The ref guard preserves user taps if the
  // query lands after the user has already started selecting.
  useEffect(() => {
    if (!editMode || seededRef.current) return;
    const existing = mySellerQuery.data?.interests;
    if (!existing) return;
    seededRef.current = true;
    if (existing.length > 0) {
      setSelected(new Set(existing));
    }
  }, [editMode, mySellerQuery.data?.interests]);

  const lang = i18n.language;

  const handleToggle = (id: string): void => {
    const isSelected = selected.has(id);
    if (!isSelected && selected.size >= MAX) {
      void Haptics.selectionAsync().catch(() => {});
      return;
    }
    const next = new Set(selected);
    if (isSelected) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSubmit = async (): Promise<void> => {
    if (selected.size < MIN || submitting) return;
    try {
      setSubmitting(true);
      await setMyInterests(Array.from(selected));
      captureEvent('onboarding_completed', { interest_count: selected.size });
      await qc.invalidateQueries({ queryKey: MY_SELLER_KEY });
      toast.success(t('onboarding.saved'));
      // Edit-mode re-entry: skip the notification prompt entirely.
      if (editMode || isOptInRecentlyDeclined()) {
        router.replace('/(protected)/(tabs)');
      } else {
        setShowNotifModal(true);
      }
    } catch {
      toast.error(t('onboarding.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = (): void => {
    router.replace('/(protected)/(tabs)');
  };

  const canContinue = selected.size >= MIN && !submitting;

  const helperText = useMemo(() => {
    if (selected.size < MIN) {
      return t('onboarding.pickMore', { count: MIN - selected.size });
    }
    return null;
  }, [selected.size, t]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="display" weight="bold">
            {editMode ? t('onboarding.editTitle') : t('onboarding.title')}
          </Text>
          <Text
            variant="body"
            color="secondary"
            style={styles.subtitle}
          >
            {t('onboarding.subtitle')}
          </Text>
        </View>
        {!editMode ? (
          <Pressable
            onPress={handleSkip}
            hitSlop={10}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
          >
            <Text variant="body" weight="semibold" color="secondary">
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.cellWrap}>
              <CategoryCell
                id={cat.id}
                label={getLocalized(cat.label, lang)}
                selected={selected.has(cat.id)}
                onPress={() => handleToggle(cat.id)}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        {helperText ? (
          <Text variant="caption" color="tertiary" style={styles.helper}>
            {helperText}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!canContinue}
          haptic="medium"
          style={[styles.cta, !canContinue && styles.ctaDisabled]}
          accessibilityRole="button"
          accessibilityLabel={
            editMode ? t('onboarding.save') : t('onboarding.continue')
          }
          accessibilityState={{ disabled: !canContinue }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.brandText} />
          ) : (
            <Text
              variant="body"
              weight="semibold"
              style={styles.ctaText}
            >
              {editMode ? t('onboarding.save') : t('onboarding.continue')}
            </Text>
          )}
        </Pressable>
      </View>
      <NotificationOptInModal
        visible={showNotifModal}
        onClose={() => {
          setShowNotifModal(false);
          router.replace('/(protected)/(tabs)');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: spacing.xs, lineHeight: 20 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cellWrap: {
    width: '48%',
  },
  cellPress: { flex: 1 },
  cellSurface: {
    aspectRatio: 4 / 5,
    padding: spacing.md,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSurfaceSelected: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  helper: {
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: colors.brandText,
  },
});
