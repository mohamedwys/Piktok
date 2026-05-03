import { useShareProduct } from '@/features/marketplace/hooks/useShareProduct';
import { useToggleLike } from '@/features/marketplace/hooks/useToggleLike';
import { useUserEngagement } from '@/features/marketplace/hooks/useUserEngagement';
import type { Product } from '@/features/marketplace/types/product';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { getLocalized } from '@/i18n/getLocalized';
import { formatActionCount, formatPrice } from '@/lib/format';
import { useCommentsSheetStore } from '@/stores/useCommentsSheetStore';
import { useMoreActionsSheetStore } from '@/stores/useMoreActionsSheetStore';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/ui';
import { colors, spacing } from '@/theme';
import LikeButton from '@/components/feed/LikeButton';

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

  const onPressLike = useCallback((): void => {
    if (!requireAuth()) return;
    toggleLike.mutate(isLiked);
  }, [isLiked, requireAuth, toggleLike]);

  const onPressBuy = useCallback((): void => {
    if (!requireAuth()) return;
    void mediumHaptic();
    useProductSheetStore.getState().open(product.id);
  }, [product.id, requireAuth]);

  const onPressComment = useCallback((): void => {
    void lightHaptic();
    useCommentsSheetStore.getState().open(product.id);
  }, [product.id]);

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

  const onPressMore = useCallback((): void => {
    void lightHaptic();
    useMoreActionsSheetStore.getState().open(product.id);
  }, [product.id]);

  const buyLabel = isPro ? t('actionRail.buy') : t('marketplace.contactSeller');
  const buyIconName = isPro ? 'bag-handle' : 'chatbubble-ellipses';

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 16 }]}>
      <IconButton
        variant="filled"
        size="lg"
        icon={
          <Ionicons name={buyIconName} size={26} color={colors.brandText} />
        }
        label={buyLabel}
        haptic="medium"
        onPress={onPressBuy}
        accessibilityLabel={t('actionRail.buyAriaLabel')}
      />

      <LikeButton
        isLiked={isLiked}
        count={likeCount}
        onToggle={onPressLike}
      />

      <IconButton
        variant="glass"
        size="md"
        icon={
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={colors.text.primary}
          />
        }
        label={formatActionCount(product.engagement.comments)}
        haptic="light"
        onPress={onPressComment}
        accessibilityLabel={t('actionRail.commentAriaLabel', {
          count: product.engagement.comments,
        })}
      />

      <IconButton
        variant="glass"
        size="md"
        icon={
          <Ionicons
            name="paper-plane-outline"
            size={20}
            color={colors.text.primary}
          />
        }
        label={t('actionRail.share')}
        haptic="light"
        onPress={onPressShare}
        accessibilityLabel={t('actionRail.shareAriaLabel')}
      />

      <IconButton
        variant="glass"
        size="md"
        icon={
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.text.primary}
          />
        }
        label={t('actionRail.more')}
        haptic="light"
        onPress={onPressMore}
        accessibilityLabel={t('actionRail.moreAriaLabel')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: spacing.lg,
  },
});
