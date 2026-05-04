import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { getLocalized } from '@/i18n/getLocalized';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import { useFormatDisplayPrice } from '@/hooks/useFormatDisplayPrice';
import type { Product } from '@/features/marketplace/types/product';

type Props = {
  product: Product;
  showOwnerActions?: boolean;
  onDelete?: (productId: string) => void;
  onEdit?: (productId: string) => void;
};

export default function SellerProductCard({
  product,
  showOwnerActions = false,
  onDelete,
  onEdit,
}: Props): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fmt = useFormatDisplayPrice();
  const onPress = () => {
    void lightHaptic();
    useProductSheetStore.getState().open(product.id);
  };
  const onPressMore = () => {
    void lightHaptic();
    Alert.alert(t('myListings.actions'), undefined, [
      {
        text: t('myListings.edit'),
        onPress: () => onEdit?.(product.id),
      },
      {
        text: t('myListings.delete'),
        style: 'destructive',
        onPress: () => onDelete?.(product.id),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.media.thumbnailUrl ?? product.media.url }}
          style={styles.image}
          resizeMode="cover"
        />
        {showOwnerActions ? (
          <Pressable
            onPress={onPressMore}
            hitSlop={8}
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {getLocalized(product.title, lang)}
        </Text>
        <Text style={styles.price}>{fmt(product.price, product.currency)}</Text>
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
  imageWrap: { width: '100%', height: '70%', backgroundColor: '#222' },
  image: { width: '100%', height: '100%' },
  moreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { padding: 8, gap: 4 },
  title: { color: '#fff', fontSize: 13, fontWeight: '600' },
  price: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
