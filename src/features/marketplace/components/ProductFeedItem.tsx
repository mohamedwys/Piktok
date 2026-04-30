import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@/features/marketplace/types/product';

type ProductFeedItemProps = {
  item: Product;
  itemHeight: number;
  // reserved for video autoplay (Step 5)
  isActive: boolean;
};

function formatPrice(value: number, currency: Product['currency']): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

export default function ProductFeedItem({
  item,
  itemHeight,
}: ProductFeedItemProps): React.ReactElement {
  const imageUri = item.media.thumbnailUrl ?? item.media.url;

  return (
    <View style={[styles.container, { height: itemHeight }]}>
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.bottomScrim} pointerEvents="none" />
      <View style={styles.priceChip}>
        <Text style={styles.priceText}>
          {formatPrice(item.price, item.currency)}
        </Text>
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.titleText} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
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
  priceChip: {
    position: 'absolute',
    top: 130,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
