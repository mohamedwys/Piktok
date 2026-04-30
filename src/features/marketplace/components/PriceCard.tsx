import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/marketplace/types/product';
import { getLocalized } from '@/i18n/getLocalized';
import { lightHaptic } from '@/features/marketplace/utils/haptics';

type PriceCardProps = {
  price: number;
  currency: Product['currency'];
  stock: Product['stock'];
  shipping: Product['shipping'];
};

function formatPrice(value: number, currency: Product['currency']): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

export default function PriceCard({
  price,
  currency,
  stock,
  shipping,
}: PriceCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const onPressBookmark = (): void => {
    void lightHaptic();
    // TODO(step-10): wire to bookmarkProduct service
    setIsBookmarked((v) => !v);
  };

  const stockLabel = stock.label
    ? getLocalized(stock.label, i18n.language)
    : stock.available
      ? t('marketplace.inStock')
      : t('marketplace.outOfStock');
  const shippingLabel = shipping.label
    ? getLocalized(shipping.label, i18n.language)
    : shipping.free
      ? t('marketplace.freeShipping')
      : t('marketplace.shippingTbd');

  return (
    <View style={styles.card}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <Text style={styles.price}>{formatPrice(price, currency)}</Text>
          <Pressable onPress={onPressBookmark} hitSlop={8}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? '#FFC83D' : '#fff'}
            />
          </Pressable>
        </View>
        <View style={styles.row}>
          <View
            style={[
              styles.dot,
              { backgroundColor: stock.available ? '#33D17A' : '#F36161' },
            ]}
          />
          <Text style={styles.stockText}>{` ${stockLabel}`}</Text>
        </View>
        <View style={styles.row}>
          <MaterialIcons
            name="local-shipping"
            size={13}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.shippingText}>{` ${shippingLabel}`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: 'transparent',
    flexShrink: 1,
    minWidth: 130,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 10,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  price: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  shippingText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
});
