import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Surface, Text } from '@/components/ui';
import { getCategoryIcon } from '@/features/categories/icons';
import { colors, spacing } from '@/theme';

export type CategoryCardItem = {
  id: string;
  label: string;
};

export type CategoryCardProps = {
  category: CategoryCardItem;
  onPress: () => void;
};

const ICON_SIZE = 28;

export function CategoryCard({
  category,
  onPress,
}: CategoryCardProps): React.ReactElement {
  const icon = getCategoryIcon(category.id);

  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      style={{ flex: 1 }}
      accessibilityLabel={category.label}
      accessibilityRole="button"
    >
      <Surface
        variant="surfaceElevated"
        radius="lg"
        border
        style={{
          aspectRatio: 4 / 5,
          padding: spacing.md,
          justifyContent: 'space-between',
        }}
      >
        {icon.lib === 'Ionicons' ? (
          <Ionicons
            name={icon.name as React.ComponentProps<typeof Ionicons>['name']}
            size={ICON_SIZE}
            color={colors.text.primary}
          />
        ) : (
          <MaterialCommunityIcons
            name={
              icon.name as React.ComponentProps<
                typeof MaterialCommunityIcons
              >['name']
            }
            size={ICON_SIZE}
            color={colors.text.primary}
          />
        )}
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {category.label}
        </Text>
      </Surface>
    </Pressable>
  );
}

export default CategoryCard;
