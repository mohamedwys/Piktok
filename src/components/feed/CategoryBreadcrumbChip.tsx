import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, Pressable, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

export type CategoryBreadcrumbChipProps = {
  category: string;
  subcategory?: string;
  onPress?: () => void;
};

const HOME_DOT_SIZE = 22;

export default function CategoryBreadcrumbChip({
  category,
  subcategory,
  onPress,
}: CategoryBreadcrumbChipProps): React.ReactElement {
  const body = (
    <GlassCard
      variant="dark"
      radius="pill"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          width: HOME_DOT_SIZE,
          height: HOME_DOT_SIZE,
          borderRadius: HOME_DOT_SIZE / 2,
          backgroundColor: colors.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="home" size={12} color={colors.text.primary} />
      </View>
      <Text variant="caption" weight="medium" color="primary">
        {category}
        {subcategory ? (
          <>
            <Text variant="caption" color="tertiary">
              {' › '}
            </Text>
            {subcategory}
          </>
        ) : null}
      </Text>
    </GlassCard>
  );

  if (!onPress) {
    return <View style={{ alignSelf: 'flex-start' }}>{body}</View>;
  }

  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        subcategory ? `${category} › ${subcategory}` : category
      }
      style={{ alignSelf: 'flex-start' }}
    >
      {body}
    </Pressable>
  );
}
