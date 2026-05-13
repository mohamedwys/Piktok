import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useRouter, type Href } from 'expo-router';
import { Avatar } from '@/components/ui';
import type { Product } from '@/features/marketplace/types/product';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import { colors } from '@/theme';

type SellerCardProps = {
  seller: Product['seller'];
};

export default function SellerCard({
  seller,
}: SellerCardProps): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();

  const onPress = () => {
    void lightHaptic();
    router.push(`/(protected)/seller/${seller.id}` as Href);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.cardInner}>
        <Avatar name={seller.name} uri={seller.avatarUrl} size={36} />
        <View style={styles.textColumn}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {seller.name}
            </Text>
            {seller.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color="#3b9eff"
                style={styles.verifiedIcon}
              />
            ) : null}
            {seller.isPro ? (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PRO</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.row}>
            <Ionicons name="star" size={11} color={colors.feedback.gold} />
            <Text style={styles.metaText} numberOfLines={1}>
              {` ${seller.rating.toFixed(1)} (${formatCount(seller.salesCount)}) · ${formatCount(seller.salesCount)} ${t('marketplace.salesUnit', { count: seller.salesCount })}`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: 'transparent',
    flexShrink: 1,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  textColumn: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  proPill: {
    marginLeft: 6,
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    flexShrink: 1,
  },
});
