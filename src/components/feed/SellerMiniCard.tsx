import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Chip,
  GlassCard,
  Pressable,
  ProBadge,
  Text,
  VerifiedCheck,
} from '@/components/ui';
import { colors, spacing } from '@/theme';

export type SellerMiniCardSeller = {
  id: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  isPro: boolean;
};

export type SellerMiniCardProps = {
  seller: SellerMiniCardSeller;
  onPressViewProfile: () => void;
};

export default function SellerMiniCard({
  seller,
  onPressViewProfile,
}: SellerMiniCardProps): React.ReactElement {
  const { t } = useTranslation();
  const sellerKindLabel = seller.isPro
    ? t('seller.professional')
    : t('seller.individual');

  return (
    <GlassCard
      variant="dark"
      radius="lg"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Avatar
        source={
          seller.avatarUrl.length > 0 ? { uri: seller.avatarUrl } : undefined
        }
        name={seller.name}
        size="sm"
      />

      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {seller.name}
          </Text>
          {seller.verified ? <VerifiedCheck size={14} /> : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
          }}
        >
          {seller.isPro ? <ProBadge size="sm" /> : null}
          <Text variant="caption" color="secondary">
            {sellerKindLabel}
          </Text>
        </View>
      </View>

      <Pressable
        haptic="light"
        onPress={onPressViewProfile}
        accessibilityRole="button"
        accessibilityLabel={t('seller.viewProfileAriaLabel', {
          name: seller.name,
        })}
      >
        <Chip
          variant="outlined"
          size="sm"
          label={t('seller.viewProfile')}
          trailingIcon={
            <Ionicons
              name="chevron-forward"
              size={12}
              color={colors.text.primary}
            />
          }
        />
      </Pressable>
    </GlassCard>
  );
}
