import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/features/marketplace/types/product';
import {
  likeProduct,
  unlikeProduct,
} from '@/features/marketplace/services/products';
import { formatCount } from '@/features/marketplace/utils/formatCount';

const BRAND_PRIMARY = '#FE2C55';

type ProductActionRailProps = {
  product: Product;
};

export default function ProductActionRail({
  product,
}: ProductActionRailProps): React.ReactElement {
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(product.engagement.likes);

  const onPressLike = (): void => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    void (async () => {
      try {
        if (nextLiked) {
          await likeProduct(product.id);
        } else {
          await unlikeProduct(product.id);
        }
      } catch {
        // Step 10 will add proper rollback + sync via React Query mutations.
      }
    })();
  };

  const onPressBuy = (): void => {};
  const onPressComment = (): void => {};
  const onPressShare = (): void => {};

  const shareLabel =
    product.engagement.shares > 0
      ? formatCount(product.engagement.shares)
      : 'Partager';

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPressBuy}
        style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}
      >
        <View style={styles.buyCircle}>
          <Ionicons name="bag-handle" size={26} color="#fff" />
        </View>
        <Text style={styles.buyLabel}>Acheter</Text>
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
    bottom: 20,
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
