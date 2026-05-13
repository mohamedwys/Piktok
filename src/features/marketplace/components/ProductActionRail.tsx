import { useShareProduct } from '@/features/marketplace/hooks/useShareProduct';
import { useToggleLike } from '@/features/marketplace/hooks/useToggleLike';
import { useIsLiked } from '@/features/marketplace/hooks/useUserEngagement';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import type { Product } from '@/features/marketplace/types/product';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { getLocalized } from '@/i18n/getLocalized';
import { formatActionCount, formatPrice } from '@/lib/format';
import { useCommentsSheetStore } from '@/stores/useCommentsSheetStore';
import { useMoreActionsSheetStore } from '@/stores/useMoreActionsSheetStore';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDismissedBanners } from '@/stores/useDismissedBanners';
import { useUpgradeFlow } from '@/hooks/useUpgradeFlow';
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

function ProductActionRail({
  product,
  tabBarHeight = 0,
}: ProductActionRailProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const isLiked = useIsLiked(product.id);
  const likeCount = product.engagement.likes;
  const toggleLike = useToggleLike(product.id);
  const shareMutation = useShareProduct();
  const { requireAuth } = useRequireAuth();
  const isPro = product.seller.isPro;

  // Phase H.4 — own-non-Pro checkout-gate. When the viewer is the
  // seller themselves AND the seller is not Pro, swap the existing
  // Buy/Contact button for an "Activer le paiement direct" upgrade
  // CTA. Replaces an awkward UX path (the existing non-Pro branch
  // would show "Contact" — but the user can't message themselves)
  // with a productive one (drive to upgrade).
  //
  // Visual integration: same `IconButton` shape (variant="filled",
  // size="lg") so the rail's vertical rhythm is preserved exactly —
  // we only swap icon, label, onPress, and accessibility copy.
  // Decision per H.4 spec's visual-fit constraint: a wider pill
  // would crowd the column, so the icon-button swap is the right
  // shape. No inline dismiss affordance for v1 (would crowd the
  // rail with an X mark on a circular button); 'checkout-gate'
  // dismissal is reserved in the store for H.13 if/when that
  // affordance lands.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mySellerQuery = useMySeller(isAuthenticated);
  const checkoutGateDismissed = useDismissedBanners((s) =>
    s.isDismissed('checkout-gate'),
  );
  const openUpgradeFlow = useUpgradeFlow();
  const isOwnListing =
    !!mySellerQuery.data?.id && mySellerQuery.data.id === product.seller.id;
  const showCheckoutGate =
    isOwnListing && !product.seller.isPro && !checkoutGateDismissed;

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

  // Branching for the leading button:
  //   - showCheckoutGate (own + non-Pro)  → "Activer" + sparkles → upgrade flow
  //   - else, isPro (someone else's Pro)  → "Acheter"  + bag       → checkout
  //   - else (someone else's non-Pro)     → "Contacter" + chat     → DM
  const buyLabel = showCheckoutGate
    ? t('pro.checkoutGateLabel')
    : isPro
      ? t('actionRail.buy')
      : t('marketplace.contactSeller');
  const buyIconName: React.ComponentProps<typeof Ionicons>['name'] =
    showCheckoutGate
      ? 'sparkles'
      : isPro
        ? 'bag-handle'
        : 'chatbubble-ellipses';
  const buyAccessibilityLabel = showCheckoutGate
    ? t('pro.checkoutGateAriaLabel')
    : t('actionRail.buyAriaLabel');
  const onPressLeading = showCheckoutGate ? openUpgradeFlow : onPressBuy;

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
        onPress={onPressLeading}
        accessibilityLabel={buyAccessibilityLabel}
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

export default React.memo(ProductActionRail, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.engagement.likes === next.product.engagement.likes &&
    prev.product.engagement.comments === next.product.engagement.comments &&
    prev.product.engagement.shares === next.product.engagement.shares &&
    prev.product.engagement.bookmarks === next.product.engagement.bookmarks &&
    prev.tabBarHeight === next.tabBarHeight
  );
});
