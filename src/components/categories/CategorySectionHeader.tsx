import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';

export type CategorySectionHeaderProps = {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
};

export function CategorySectionHeader({
  title,
  subtitle,
  trailing,
}: CategorySectionHeaderProps): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text variant="title" weight="semibold">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export default CategorySectionHeader;
