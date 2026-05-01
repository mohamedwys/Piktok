import { useToggleLike } from '@/features/marketplace/hooks/useToggleLike';
import { useUserEngagement } from '@/features/marketplace/hooks/useUserEngagement';
import type { Product } from '@/features/marketplace/types/product';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const BRAND_PRIMARY = '#FE2C55';

type ProductActionRailProps = {
  product: Product;
  tabBarHeight?: number;
};

export default function ProductActionRail({
  product,
  tabBarHeight = 0,
}: ProductActionRailProps): React.ReactElement {
  const { t } = useTranslation();
  const { data: engagement } = useUserEngagement();
  const isLiked = engagement?.likedIds.has(product.id) ?? false;
  const likeCount = product.engagement.likes;
  const toggleLike = useToggleLike(product.id);
  const { requireAuth } = useRequireAuth();
  const isPro = product.seller.isPro;

  const onPressLike = (): void => {
    if (!requireAuth()) return;
    void lightHaptic();
    toggleLike.mutate(isLiked);
  };

  const onPressBuy = (): void => {
    void mediumHaptic();
    useProductSheetStore.getState().open(product.id);
  };
  const onPressComment = (): void => {};
  const onPressShare = (): void => {};

  const shareLabel =
    product.engagement.shares > 0
      ? formatCount(product.engagement.shares)
      : t('marketplace.share');

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 16 }]}>
      <Pressable
        onPress={onPressBuy}
        style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}
      >
        <View style={styles.buyCircle}>
          <Ionicons
            name={isPro ? 'bag-handle' : 'chatbubble-ellipses'}
            size={26}
            color="#fff"
          />
        </View>
        <Text style={styles.buyLabel}>
          {isPro ? t('marketplace.buy') : t('marketplace.contactSeller')}
        </Text>
      </Pressable>

      <Pressable
        onPress={onPressLike}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={33}
          color={isLiked ? BRAND_PRIMARY : '#fff'}
        />
        <Text style={styles.label}>{formatCount(likeCount)}</Text>
      </Pressable>

      <Pressable
        onPress={onPressComment}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubble" size={30} color="#fff" />
        <Text style={styles.label}>
          {formatCount(product.engagement.comments)}
        </Text>
      </Pressable>

      <Pressable
        onPress={onPressShare}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="paper-plane" size={30} color="#fff" />
        <Text style={styles.label}>{shareLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 14,
    alignItems: 'flex-end',
    gap: 25,
  },
  pressed: {
    opacity: 0.6,
  },
  buyButton: {
    alignItems: 'center',
    gap: 6,
  },
  buyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  buyLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  button: {
    alignItems: 'center',
    gap: 5,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
