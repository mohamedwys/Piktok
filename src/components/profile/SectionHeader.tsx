import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({
  title,
  subtitle,
}: SectionHeaderProps): React.ReactElement {
  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
      <Text variant="label" color="secondary">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="tertiary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default SectionHeader;
