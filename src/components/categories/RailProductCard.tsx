import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard, Pressable, Text } from '@/components/ui';
import type { Product } from '@/features/marketplace/types/product';
import { getLocalized } from '@/i18n/getLocalized';
import { formatDistance } from '@/lib/format';
import { useFormatDisplayPrice } from '@/hooks/useFormatDisplayPrice';
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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const title = getLocalized(product.title, lang);
  const fmt = useFormatDisplayPrice();
  const imageUri = product.media.thumbnailUrl ?? product.media.url;
  const showDistance =
    typeof distanceKm === 'number' && Number.isFinite(distanceKm);
  // H.12: a listing is currently featured iff its `featured_until` is in
  // the future. Cards anywhere in the app can opt-in to the badge by
  // simply having a Product with this field populated; no parent flag
  // required.
  const isFeatured =
    !!product.featuredUntil
    && new Date(product.featuredUntil).getTime() > Date.now();

  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      style={{ width: CARD_WIDTH }}
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      <GlassCard variant="dark" radius="lg" border>
        <View>
          <Image
            source={{ uri: imageUri }}
            style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
            contentFit="cover"
            transition={150}
          />
          {isFeatured ? (
            <View style={styles.featuredBadge}>
              <Ionicons name="sparkles" size={10} color={colors.brand} />
              <Text
                variant="caption"
                weight="semibold"
                style={styles.featuredBadgeText}
              >
                {t('feed.featured')}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ padding: spacing.sm, gap: 2 }}>
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color="secondary">
            {fmt(product.price, product.currency)}
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

const styles = StyleSheet.create({
  featuredBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  featuredBadgeText: {
    color: colors.brand,
    fontSize: 11,
  },
});

export default RailProductCard;
