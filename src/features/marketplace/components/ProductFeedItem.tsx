import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product } from '@/features/marketplace/types/product';
import ProductActionRail from '@/features/marketplace/components/ProductActionRail';
import SellerCard from '@/features/marketplace/components/SellerCard';
import PriceCard from '@/features/marketplace/components/PriceCard';

type ProductFeedItemProps = {
  item: Product;
  itemHeight: number;
  isActive: boolean;
};

export default function ProductFeedItem({
  item,
  itemHeight,
  isActive,
}: ProductFeedItemProps): React.ReactElement {
  const isVideo = item.media.type === 'video';
  const insets = useSafeAreaInsets();
  const topRowTop = insets.top + 78;

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
      <View style={styles.bottomScrim} pointerEvents="none" />
      <View style={[styles.topRow, { top: topRowTop }]} pointerEvents="box-none">
        <View style={styles.topRowLeft} pointerEvents="box-none">
          <SellerCard seller={item.seller} />
        </View>
        <View style={styles.topRowRight} pointerEvents="box-none">
          <PriceCard
            price={item.price}
            currency={item.currency}
            stock={item.stock}
            shipping={item.shipping}
          />
        </View>
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.titleText} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <ProductActionRail product={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  topRowLeft: {
    flexShrink: 1,
    flexGrow: 0,
    flexBasis: 'auto',
    maxWidth: '60%',
  },
  topRowRight: {
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'flex-end',
  },
  titleWrap: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: '30%',
  },
  titleText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
});
