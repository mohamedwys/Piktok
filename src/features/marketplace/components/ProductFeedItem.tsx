import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Product } from '@/features/marketplace/types/product';
import ProductActionRail from '@/features/marketplace/components/ProductActionRail';
import ProductBottomPanel from '@/features/marketplace/components/ProductBottomPanel';
import SellerPill, { type SellerPillSeller } from '@/components/feed/SellerPill';
import PriceCard from '@/components/feed/PriceCard';
import { MARKETPLACE_HEADER_ROW_HEIGHT } from '@/components/feed/MarketplaceHeader';
import { useUserEngagement } from '@/features/marketplace/hooks/useUserEngagement';
import { useToggleBookmark } from '@/features/marketplace/hooks/useToggleBookmark';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { spacing, zIndex as zIndexTokens } from '@/theme';

type ProductFeedItemProps = {
  item: Product;
  itemHeight: number;
  isActive: boolean;
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
}: ProductFeedItemProps): React.ReactElement {
  const isVideo = item.media.type === 'video';
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const topRowTop =
    insets.top + MARKETPLACE_HEADER_ROW_HEIGHT + spacing.md;
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState(false);

  const player = useVideoPlayer(isVideo ? item.media.url : null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!isVideo) return;
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

  const scrimProgress = useSharedValue(bottomPanelExpanded ? 1 : 0);
  useEffect(() => {
    scrimProgress.value = withTiming(bottomPanelExpanded ? 1 : 0, { duration: 250 });
  }, [bottomPanelExpanded, scrimProgress]);

  const scrimAnimStyle = useAnimatedStyle(() => {
    const height = interpolate(scrimProgress.value, [0, 1], [32, 60]);
    return { height: `${height}%` };
  });

  const { data: engagement } = useUserEngagement();
  const isSaved = engagement?.bookmarkedIds.has(item.id) ?? false;
  const toggleBookmark = useToggleBookmark(item.id);
  const { requireAuth } = useRequireAuth();

  const onToggleSave = (): void => {
    if (!requireAuth()) return;
    toggleBookmark.mutate(isSaved);
  };

  const onPressSeller = (): void => {
    router.push(`/(protected)/seller/${item.seller.id}` as Href);
  };

  return (
    <View style={[styles.container, { height: itemHeight }]}>
      {isVideo ? (
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
      <Animated.View style={[styles.gradient, scrimAnimStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
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
      <ProductBottomPanel
        product={item}
        expanded={bottomPanelExpanded}
        onToggleExpanded={() => setBottomPanelExpanded((v) => !v)}
        tabBarHeight={tabBarHeight}
      />
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
});
