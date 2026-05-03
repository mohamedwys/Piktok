import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard, Pressable, Text } from '@/components/ui';
import type { Product } from '@/features/marketplace/types/product';
import { getLocalized } from '@/i18n/getLocalized';
import { formatDistance, formatPrice } from '@/lib/format';
import { colors, spacing } from '@/theme';

export type RailProductCardProps = {
  product: Product;
  onPress: () => void;
  distanceKm?: number | null;
};

const CARD_WIDTH = 156;
const CARD_IMAGE_HEIGHT = 156;

export function RailProductCard({
  product,
  onPress,
  distanceKm,
}: RailProductCardProps): React.ReactElement {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const title = getLocalized(product.title, lang);
  const imageUri = product.media.thumbnailUrl ?? product.media.url;
  const showDistance =
    typeof distanceKm === 'number' && Number.isFinite(distanceKm);

  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      style={{ width: CARD_WIDTH }}
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      <GlassCard variant="dark" radius="lg" border>
        <Image
          source={{ uri: imageUri }}
          style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
          contentFit="cover"
          transition={150}
        />
        <View style={{ padding: spacing.sm, gap: 2 }}>
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color="secondary">
            {formatPrice(product.price, product.currency)}
          </Text>
          {showDistance ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                marginTop: 2,
              }}
            >
              <Ionicons
                name="navigate"
                size={10}
                color={colors.text.tertiary}
              />
              <Text
                variant="caption"
                color="tertiary"
                style={{ fontSize: 11 }}
              >
                {formatDistance(distanceKm)}
              </Text>
            </View>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default RailProductCard;
