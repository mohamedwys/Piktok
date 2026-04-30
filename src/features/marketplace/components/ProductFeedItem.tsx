import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product } from '@/features/marketplace/types/product';
import ProductActionRail from '@/features/marketplace/components/ProductActionRail';
import SellerCard from '@/features/marketplace/components/SellerCard';
import PriceCard from '@/features/marketplace/components/PriceCard';
import ProductBottomPanel from '@/features/marketplace/components/ProductBottomPanel';

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
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
        locations={[0, 1]}
        style={[styles.gradient, { height: bottomPanelExpanded ? '60%' : '32%' }]}
        pointerEvents="none"
      />
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
      <ProductActionRail product={item} />
      <ProductBottomPanel
        product={item}
        expanded={bottomPanelExpanded}
        onToggleExpanded={() => setBottomPanelExpanded((v) => !v)}
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
});
