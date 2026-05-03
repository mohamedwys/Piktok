import React from 'react';
import { View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui';
import {
  attributeIcon,
  type AttributeIcon,
} from '@/features/marketplace/utils/attributeIcon';
import { getLocalized } from '@/i18n/getLocalized';
import { formatDistance } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { ProductAttribute } from '@/features/marketplace/types/product';

export type ProductTagChipRowProps = {
  attributes: ProductAttribute[];
  dimensions?: string;
  distanceKm?: number | null;
};

const ICON_SIZE = 12;

function iconNode(spec: AttributeIcon): React.ReactElement {
  if (spec.family === 'ionicons') {
    return (
      <Ionicons
        name={
          spec.name as React.ComponentProps<typeof Ionicons>['name']
        }
        size={ICON_SIZE}
        color={colors.text.primary}
      />
    );
  }
  if (spec.family === 'material') {
    return (
      <MaterialIcons
        name={
          spec.name as React.ComponentProps<typeof MaterialIcons>['name']
        }
        size={ICON_SIZE}
        color={colors.text.primary}
      />
    );
  }
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.text.primary,
      }}
    />
  );
}

export default function ProductTagChipRow({
  attributes,
  dimensions,
  distanceKm,
}: ProductTagChipRowProps): React.ReactElement | null {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const showDistance =
    typeof distanceKm === 'number' && Number.isFinite(distanceKm);
  const distanceLabel = showDistance ? formatDistance(distanceKm as number) : null;

  const trimmedDimensions = dimensions?.trim() ?? '';
  const showDimensions = trimmedDimensions.length > 0;

  const visibleAttributes = attributes.filter((a) => {
    const label = getLocalized(a.label, lang);
    return typeof label === 'string' && label.trim().length > 0;
  });

  if (
    !showDistance &&
    !showDimensions &&
    visibleAttributes.length === 0
  ) {
    return null;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
      }}
    >
      {showDistance && distanceLabel ? (
        <Chip
          variant="glass"
          size="sm"
          leadingIcon={
            <Ionicons
              name="navigate"
              size={ICON_SIZE}
              color={colors.text.primary}
            />
          }
          label={distanceLabel}
        />
      ) : null}

      {visibleAttributes.map((attr) => (
        <Chip
          key={attr.id}
          variant="glass"
          size="sm"
          leadingIcon={iconNode(attributeIcon(attr.iconKey))}
          label={getLocalized(attr.label, lang)}
        />
      ))}

      {showDimensions ? (
        <Chip
          variant="glass"
          size="sm"
          leadingIcon={iconNode({ family: 'material', name: 'straighten' })}
          label={trimmedDimensions}
        />
      ) : null}
    </View>
  );
}
