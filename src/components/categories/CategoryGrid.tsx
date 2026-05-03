import React from 'react';
import { FlatList } from 'react-native';
import { CategoryCard, type CategoryCardItem } from './CategoryCard';
import { spacing } from '@/theme';

export type CategoryGridProps = {
  categories: CategoryCardItem[];
  onPressCategory: (id: string) => void;
};

export function CategoryGrid({
  categories,
  onPressCategory,
}: CategoryGridProps): React.ReactElement {
  return (
    <FlatList
      key="col-2"
      data={categories}
      numColumns={2}
      keyExtractor={(c) => c.id}
      scrollEnabled={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
      columnWrapperStyle={{ gap: spacing.md }}
      renderItem={({ item }) => (
        <CategoryCard
          category={item}
          onPress={() => onPressCategory(item.id)}
        />
      )}
    />
  );
}

export default CategoryGrid;
