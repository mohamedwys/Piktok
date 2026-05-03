import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui';
import CategoryRail from '@/components/categories/CategoryRail';
import CategorySectionHeader from '@/components/categories/CategorySectionHeader';
import CategoryGrid from '@/components/categories/CategoryGrid';
import NearbyProductsRail from '@/components/categories/NearbyProductsRail';
import { CATEGORIES } from '@/features/marketplace/data/categories';
import { useTrendingProducts } from '@/features/marketplace/hooks/useTrendingProducts';
import { useNewestProducts } from '@/features/marketplace/hooks/useNewestProducts';
import { useMarketplaceFilters } from '@/stores/useMarketplaceFilters';
import { useMainTabStore } from '@/stores/useMainTabStore';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { getLocalized } from '@/i18n/getLocalized';
import { colors, spacing } from '@/theme';

export default function CategoriesScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const setFilters = useMarketplaceFilters((s) => s.setFilters);
  const setMainTab = useMainTabStore((s) => s.setMainTab);
  const openProduct = useProductSheetStore((s) => s.open);

  const trendingQuery = useTrendingProducts();
  const newestQuery = useNewestProducts();

  const onPressCategory = (id: string): void => {
    void mediumHaptic();
    setFilters({ categoryId: id, subcategoryId: null });
    setMainTab('marketplace');
    router.push('/(protected)/(tabs)');
  };

  const onPressProduct = (id: string): void => {
    openProduct(id);
  };

  const localizedCategories = CATEGORIES.map((c) => ({
    id: c.id,
    label: getLocalized(c.label, lang),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: tabBarHeight + spacing.lg,
        }}
      >
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Text variant="title" weight="semibold">
            {t('categories.title')}
          </Text>
          <Text variant="caption" color="secondary">
            {t('categories.subtitle')}
          </Text>
        </View>

        <CategoryRail
          title={t('categories.trending')}
          products={trendingQuery.data?.items ?? []}
          loading={trendingQuery.isLoading}
          onPressItem={onPressProduct}
        />

        <CategoryRail
          title={t('categories.newest')}
          products={newestQuery.data?.items ?? []}
          loading={newestQuery.isLoading}
          onPressItem={onPressProduct}
        />

        <NearbyProductsRail />

        <View style={{ marginTop: spacing.xl }}>
          <CategorySectionHeader title={t('categories.allCategories')} />
          <CategoryGrid
            categories={localizedCategories}
            onPressCategory={onPressCategory}
          />
        </View>
      </ScrollView>
    </View>
  );
}
