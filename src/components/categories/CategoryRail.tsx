import React from 'react';
import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Surface, Text } from '@/components/ui';
import { CategorySectionHeader } from './CategorySectionHeader';
import { RailProductCard } from './RailProductCard';
import type { Product } from '@/features/marketplace/types/product';
import { spacing } from '@/theme';

export type CategoryRailProps = {
  title: string;
  products: Product[];
  loading: boolean;
  onPressItem: (id: string) => void;
};

const SKELETON_WIDTH = 156;
const SKELETON_HEIGHT = 220;

export function CategoryRail({
  title,
  products,
  loading,
  onPressItem,
}: CategoryRailProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View>
      <CategorySectionHeader title={title} />
      {loading ? (
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Surface
              key={i}
              variant="surfaceElevated"
              radius="lg"
              style={{ width: SKELETON_WIDTH, height: SKELETON_HEIGHT }}
            />
          ))}
        </View>
      ) : products.length === 0 ? (
        <Text
          variant="caption"
          color="tertiary"
          style={{ paddingHorizontal: spacing.lg }}
        >
          {t('categories.noProducts')}
        </Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
          renderItem={({ item }) => (
            <RailProductCard
              product={item}
              onPress={() => onPressItem(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

export default CategoryRail;
