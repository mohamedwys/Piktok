import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFilterSheetStore } from '@/stores/useFilterSheetStore';
import {
  useMarketplaceFilters,
  type MarketplaceFilters,
} from '@/stores/useMarketplaceFilters';
import { CATEGORIES, findCategory } from '@/features/marketplace/data/categories';
import { getLocalized } from '@/i18n/getLocalized';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';

const BRAND_PRIMARY = '#FE2C55';
const SHEET_BG = '#0a0a0a';

function priceToText(value: number | null): string {
  return value === null ? '' : String(value);
}

export default function MarketplaceFilterSheet(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const insets = useSafeAreaInsets();
  const isOpen = useFilterSheetStore((s) => s.isOpen);
  const close = useFilterSheetStore((s) => s.close);
  const filters = useMarketplaceFilters((s) => s.filters);
  const setFilters = useMarketplaceFilters((s) => s.setFilters);
  const resetFilters = useMarketplaceFilters((s) => s.resetFilters);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const [draft, setDraft] = useState<MarketplaceFilters>(filters);
  const [priceText, setPriceText] = useState<string>(priceToText(filters.priceMax));

  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      setPriceText(priceToText(filters.priceMax));
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) close();
    },
    [close],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.6}
      />
    ),
    [],
  );

  const onPressApply = (): void => {
    void mediumHaptic();
    const trimmed = priceText.trim().replace(',', '.');
    const parsed = trimmed.length > 0 ? Number(trimmed) : NaN;
    const priceMax = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    setFilters({ ...draft, priceMax });
    close();
  };

  const onPressReset = (): void => {
    void lightHaptic();
    resetFilters();
    close();
  };

  const onSelectCategory = (id: string | null): void => {
    void lightHaptic();
    setDraft((d) => ({ ...d, categoryId: id, subcategoryId: null }));
  };

  const onSelectSubcategory = (id: string | null): void => {
    void lightHaptic();
    setDraft((d) => ({ ...d, subcategoryId: id }));
  };

  const subcategories = draft.categoryId
    ? findCategory(draft.categoryId)?.subcategories ?? []
    : [];

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom + 12}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={onPressReset}
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerReset,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.footerResetText}>{t('search.reset')}</Text>
          </Pressable>
          <Pressable
            onPress={onPressApply}
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerApply,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.footerApplyText}>{t('search.apply')}</Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, insets.bottom, draft, priceText],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('search.title')}</Text>
          <Pressable
            onPress={onPressReset}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.headerLink}>{t('search.reset')}</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('search.queryPlaceholder')}</Text>
          <TextInput
            value={draft.query}
            onChangeText={(v) => setDraft((d) => ({ ...d, query: v }))}
            placeholder={t('search.queryPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('search.categorySection')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label={t('search.all')}
              active={draft.categoryId === null}
              onPress={() => onSelectCategory(null)}
            />
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.id}
                label={getLocalized(cat.label, lang)}
                active={draft.categoryId === cat.id}
                onPress={() => onSelectCategory(cat.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t('search.subcategorySection')}
          </Text>
          {draft.categoryId === null ? (
            <Text style={styles.hintText}>{t('search.subcategoryHint')}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={t('search.all')}
                active={draft.subcategoryId === null}
                onPress={() => onSelectSubcategory(null)}
              />
              {subcategories.map((sub) => (
                <Chip
                  key={sub.id}
                  label={getLocalized(sub.label, lang)}
                  active={draft.subcategoryId === sub.id}
                  onPress={() => onSelectSubcategory(sub.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('search.priceMaxLabel')}</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder={t('search.priceMaxPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('search.pickupOnly')}</Text>
          <Switch
            value={draft.pickupOnly}
            onValueChange={(v) => setDraft((d) => ({ ...d, pickupOnly: v }))}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: BRAND_PRIMARY }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('search.locationLabel')}</Text>
          <TextInput
            value={draft.locationQuery}
            onChangeText={(v) => setDraft((d) => ({ ...d, locationQuery: v }))}
            placeholder={t('search.locationPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Chip({ label, active, onPress }: ChipProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipInactive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextInactive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: SHEET_BG,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerLink: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: BRAND_PRIMARY,
    borderColor: BRAND_PRIMARY,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipTextInactive: {
    color: 'rgba(255,255,255,0.7)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  footerButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerReset: {
    flex: 1,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
  },
  footerResetText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerApply: {
    flex: 1.4,
    backgroundColor: BRAND_PRIMARY,
  },
  footerApplyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
