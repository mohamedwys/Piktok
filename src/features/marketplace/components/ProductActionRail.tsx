import { useShareProduct } from '@/features/marketplace/hooks/useShareProduct';
import { useToggleLike } from '@/features/marketplace/hooks/useToggleLike';
import { useUserEngagement } from '@/features/marketplace/hooks/useUserEngagement';
import type { Product } from '@/features/marketplace/types/product';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { getLocalized } from '@/i18n/getLocalized';
import { formatPrice } from '@/lib/format';
import { useCommentsSheetStore } from '@/stores/useCommentsSheetStore';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type ProductActionRailProps = {
  product: Product;
  tabBarHeight?: number;
};

export default function ProductActionRail({
  product,
  tabBarHeight = 0,
}: ProductActionRailProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { data: engagement } = useUserEngagement();
  const isLiked = engagement?.likedIds.has(product.id) ?? false;
  const likeCount = product.engagement.likes;
  const toggleLike = useToggleLike(product.id);
  const shareMutation = useShareProduct();
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
  const onPressComment = (): void => {
    void lightHaptic();
    useCommentsSheetStore.getState().open(product.id);
  };
  const onPressShare = useCallback((): void => {
    if (!requireAuth()) return;
    void lightHaptic();
    const locale: 'fr' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'fr';
    shareMutation.mutate({
      productId: product.id,
      title: getLocalized(product.title, locale),
      priceLabel: formatPrice(
        product.price,
        product.currency ?? 'EUR',
        locale === 'fr' ? 'fr-FR' : 'en-US',
      ),
      locale,
    });
  }, [
    i18n.language,
    product.id,
    product.title,
    product.price,
    product.currency,
    requireAuth,
    shareMutation,
  ]);

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
          color={isLiked ? colors.brand : '#fff'}
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
    backgroundColor: colors.brand,
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
