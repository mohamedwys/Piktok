import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { VideoView } from 'expo-video';
import { usePooledVideoPlayer } from '@/features/marketplace/components/VideoPlayerPool';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import type { Product } from '@/features/marketplace/types/product';
import ProductActionRail from '@/features/marketplace/components/ProductActionRail';
import ProductBottomPanel from '@/features/marketplace/components/ProductBottomPanel';
import SellerPill, { type SellerPillSeller } from '@/components/feed/SellerPill';
import PriceCard from '@/components/feed/PriceCard';
import { Text } from '@/components/ui';
import { MARKETPLACE_HEADER_ROW_HEIGHT } from '@/components/feed/MarketplaceHeader';
import { useIsBookmarked, useIsLiked } from '@/features/marketplace/hooks/useUserEngagement';
import { useToggleBookmark } from '@/features/marketplace/hooks/useToggleBookmark';
import { useToggleLike } from '@/features/marketplace/hooks/useToggleLike';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { colors, spacing, zIndex as zIndexTokens } from '@/theme';

type ProductFeedItemProps = {
  item: Product;
  itemHeight: number;
  isActive: boolean;
  insetsTop: number;
  tabBarHeight: number;
};

function toSellerPillSeller(seller: Product['seller']): SellerPillSeller {
  return {
    id: seller.id,
    name: seller.name,
    avatarUrl: seller.avatarUrl,
    verified: seller.verified,
    isPro: seller.isPro,
    rating: seller.rating,
    // The Supabase `Seller` shape does not yet track review count
    // separately; reuse `salesCount` as a proxy until a dedicated
    // column lands. Mapping happens here so SellerPill stays canonical.
    ratingCount: seller.salesCount,
    salesCount: seller.salesCount,
  };
}

export default function ProductFeedItem({
  item,
  itemHeight,
  isActive,
  insetsTop,
  tabBarHeight,
}: ProductFeedItemProps): React.ReactElement {
  const isVideo = item.media.type === 'video';
  const router = useRouter();
  const topRowTop = insetsTop + MARKETPLACE_HEADER_ROW_HEIGHT + spacing.md;

  const player = usePooledVideoPlayer(
    item.id,
    isVideo ? item.media.url : null,
  );

  useEffect(() => {
    if (!isVideo) return;
    if (!player) return;
    try {
      if (isActive) {
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Player may not be ready on first mount; next render will retry.
    }
  }, [isActive, isVideo, player]);

  const { t } = useTranslation();
  const isSaved = useIsBookmarked(item.id);
  const toggleBookmark = useToggleBookmark(item.id);
  const { requireAuth } = useRequireAuth();
  // H.12: render the "À la une" badge on top of the media when the
  // listing's boost is still live. Positioned in the top-left
  // corner above SellerPill.
  const isFeatured =
    !!item.featuredUntil
    && new Date(item.featuredUntil).getTime() > Date.now();

  const onToggleSave = (): void => {
    if (!requireAuth()) return;
    toggleBookmark.mutate(isSaved);
  };

  const onPressSeller = (): void => {
    router.push(`/(protected)/seller/${item.seller.id}` as Href);
  };

  const isLiked = useIsLiked(item.id);
  const toggleLike = useToggleLike(item.id);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const triggerLike = (): void => {
    if (!requireAuth()) return;
    if (!isLiked) toggleLike.mutate(false);
  };

  const playBurst = (): void => {
    'worklet';
    heartScale.value = 0.6;
    heartOpacity.value = 0;
    heartScale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withSpring(0.95, { damping: 14, stiffness: 220 }),
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(380, withTiming(0, { duration: 220 })),
    );
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      'worklet';
      playBurst();
      runOnJS(triggerLike)();
    });

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  return (
    <View style={[styles.container, { height: itemHeight }]}>
      <GestureDetector gesture={doubleTap}>
        <Animated.View style={StyleSheet.absoluteFill}>
          {isVideo && player ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture={false}
            />
          ) : (
            <Image
              source={{ uri: item.media.thumbnailUrl ?? item.media.url }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}
          <View style={styles.gradient} pointerEvents="none">
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
              locations={[0, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[styles.heartOverlay, heartStyle]}
          >
            <Ionicons name="heart" size={120} color={colors.brand} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {isFeatured ? (
        <View
          style={[styles.featuredBadge, { top: topRowTop - 28 }]}
          pointerEvents="none"
        >
          <Ionicons name="sparkles" size={11} color={colors.brand} />
          <Text
            variant="caption"
            weight="semibold"
            style={styles.featuredBadgeText}
          >
            {t('feed.featured')}
          </Text>
        </View>
      ) : null}
      <View style={[styles.topRow, { top: topRowTop }]} pointerEvents="box-none">
        <View style={styles.topRowLeft} pointerEvents="box-none">
          <SellerPill
            seller={toSellerPillSeller(item.seller)}
            onPress={onPressSeller}
          />
        </View>
        <View style={{ width: spacing.md }} />
        <View style={styles.topRowRight} pointerEvents="box-none">
          <PriceCard
            amount={item.price}
            currency={item.currency}
            inStock={item.stock.available}
            freeShipping={item.shipping.free}
            isSaved={isSaved}
            onToggleSave={onToggleSave}
          />
        </View>
      </View>
      <ProductActionRail product={item} tabBarHeight={tabBarHeight} />
      <ProductBottomPanel product={item} tabBarHeight={tabBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topRow: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: zIndexTokens.overlay,
  },
  topRowLeft: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  topRowRight: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'flex-end',
  },
  featuredBadge: {
    position: 'absolute',
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: zIndexTokens.overlay,
  },
  featuredBadgeText: {
    color: colors.brand,
    fontSize: 11,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
