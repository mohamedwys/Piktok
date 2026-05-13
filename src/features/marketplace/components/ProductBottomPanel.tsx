import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, type Href } from 'expo-router';
import type { Product } from '@/features/marketplace/types/product';
import { getLocalized } from '@/i18n/getLocalized';
import { useMarketplaceFilters } from '@/stores/useMarketplaceFilters';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import { Pressable, Text } from '@/components/ui';
import { colors, spacing, zIndex as zIndexTokens } from '@/theme';
import CategoryBreadcrumbChip from '@/components/feed/CategoryBreadcrumbChip';
import ProductTitle from '@/components/feed/ProductTitle';
import ProductTagChipRow from '@/components/feed/ProductTagChipRow';
import SellerMiniCard, {
  type SellerMiniCardSeller,
} from '@/components/feed/SellerMiniCard';

type ProductBottomPanelProps = {
  product: Product;
  tabBarHeight?: number;
};

const ACTION_RAIL_RESERVE = 72;

function toMiniCardSeller(seller: Product['seller']): SellerMiniCardSeller {
  return {
    id: seller.id,
    name: seller.name,
    avatarUrl: seller.avatarUrl,
    verified: seller.verified,
    isPro: seller.isPro,
  };
}

function ProductBottomPanel({
  product,
  tabBarHeight = 0,
}: ProductBottomPanelProps): React.ReactElement {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const setFilters = useMarketplaceFilters((s) => s.setFilters);
  const lang = i18n.language;
  const title = getLocalized(product.title, lang);
  const description = getLocalized(product.description, lang);
  const categoryPrimary = getLocalized(product.category.primary, lang);
  const categorySecondary = getLocalized(product.category.secondary, lang);

  const [expanded, setExpanded] = useState<boolean>(false);

  const trimmedDescription = description?.trim() ?? '';
  const hasDescription = trimmedDescription.length > 0;

  const onPressBreadcrumb = useCallback(() => {
    if (!product.categoryId) return;
    void lightHaptic();
    setFilters({
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId ?? null,
    });
  }, [product.categoryId, product.subcategoryId, setFilters]);

  const onPressViewProfile = useCallback(() => {
    void lightHaptic();
    router.push(`/(protected)/seller/${product.seller.id}` as Href);
  }, [product.seller.id, router]);

  const onToggleExpanded = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  return (
    <View
      style={[styles.panel, { bottom: tabBarHeight + spacing.lg }]}
      pointerEvents="box-none"
    >
      <View style={styles.upperContent}>
        <CategoryBreadcrumbChip
          category={categoryPrimary}
          subcategory={categorySecondary}
          onPress={product.categoryId ? onPressBreadcrumb : undefined}
        />

        <ProductTitle title={title} />

        {expanded && hasDescription ? (
          <Text variant="body" color="primary">
            {trimmedDescription}
          </Text>
        ) : null}

        <ProductTagChipRow
          attributes={product.attributes}
          dimensions={product.dimensions}
          distanceKm={product.distanceKm}
        />

        <Pressable
          haptic="light"
          onPress={onToggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? t('feedItem.showLess') : t('feedItem.showMore')
          }
          accessibilityState={{ expanded }}
          style={styles.toggleRow}
        >
          <Text variant="body" color="primary">
            {expanded ? t('feedItem.showLess') : t('feedItem.showMore')}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.text.primary}
          />
        </Pressable>
      </View>

      {expanded ? (
        <SellerMiniCard
          seller={toMiniCardSeller(product.seller)}
          onPressViewProfile={onPressViewProfile}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.md,
    zIndex: zIndexTokens.overlay,
  },
  upperContent: {
    gap: spacing.sm,
    paddingRight: ACTION_RAIL_RESERVE,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
});

export default React.memo(ProductBottomPanel, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.tabBarHeight === next.tabBarHeight
  );
});
