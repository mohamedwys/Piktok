import React from 'react';
import { FlatList, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard, Pressable, Surface, Text } from '@/components/ui';
import { CategorySectionHeader } from './CategorySectionHeader';
import { RailProductCard } from './RailProductCard';
import { useNearbyRailProducts } from '@/features/marketplace/hooks/useNearbyRailProducts';
import { useUserLocation } from '@/features/location/stores/useUserLocation';
import { useLocationSheetStore } from '@/stores/useLocationSheetStore';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { colors, spacing } from '@/theme';

const SKELETON_WIDTH = 156;
const SKELETON_HEIGHT = 220;

type NoLocationCTAProps = { onPress: () => void };

function NoLocationCTA({ onPress }: NoLocationCTAProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <Pressable
        haptic="light"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('location.activatePromptTitle')}
      >
        <GlassCard variant="dark" radius="lg" border>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.brandMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="navigate" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" weight="semibold">
                {t('location.activatePromptTitle')}
              </Text>
              <Text variant="caption" color="secondary">
                {t('location.activatePromptBody')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.text.tertiary}
            />
          </View>
        </GlassCard>
      </Pressable>
    </View>
  );
}

function RailSkeletons({ count = 3 }: { count?: number }): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Surface
          key={i}
          variant="surfaceElevated"
          radius="lg"
          style={{ width: SKELETON_WIDTH, height: SKELETON_HEIGHT }}
        />
      ))}
    </View>
  );
}

export function NearbyProductsRail(): React.ReactElement {
  const { t } = useTranslation();
  const { products, loading, isEnabled } = useNearbyRailProducts();
  const radiusKm = useUserLocation((s) => s.radiusKm);
  const openLocationSheet = useLocationSheetStore((s) => s.open);
  const openProduct = useProductSheetStore((s) => s.open);

  if (!isEnabled) {
    return (
      <View style={{ paddingVertical: spacing.md }}>
        <CategorySectionHeader title={t('location.nearYou')} />
        <NoLocationCTA
          onPress={() => {
            void mediumHaptic();
            openLocationSheet();
          }}
        />
      </View>
    );
  }

  const subtitle =
    radiusKm === null
      ? t('location.everywhere')
      : t('location.withinRadius', { km: radiusKm });

  return (
    <View>
      <CategorySectionHeader
        title={t('location.nearYou')}
        subtitle={subtitle}
      />
      {loading && products.length === 0 ? (
        <RailSkeletons count={3} />
      ) : products.length === 0 ? (
        <Text
          variant="caption"
          color="tertiary"
          style={{ paddingHorizontal: spacing.lg }}
        >
          {t('location.noProductsInRadius')}
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
              distanceKm={item.distanceKm}
              onPress={() => openProduct(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

export default NearbyProductsRail;
