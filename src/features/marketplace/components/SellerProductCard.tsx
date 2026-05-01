import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { getLocalized } from '@/i18n/getLocalized';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import type { Product } from '@/features/marketplace/types/product';

type Props = { product: Product };

export default function SellerProductCard({ product }: Props): React.ReactElement {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const onPress = () => {
    void lightHaptic();
    useProductSheetStore.getState().open(product.id);
  };
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: product.currency,
  }).format(product.price);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <Image
        source={{ uri: product.media.thumbnailUrl ?? product.media.url }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {getLocalized(product.title, lang)}
        </Text>
        <Text style={styles.price}>{formatted}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.7,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  image: { width: '100%', height: '70%', backgroundColor: '#222' },
  info: { padding: 8, gap: 4 },
  title: { color: '#fff', fontSize: 13, fontWeight: '600' },
  price: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
