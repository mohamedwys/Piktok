import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Pressable, ProBadge, Text, VerifiedCheck } from '@/components/ui';
import { colors, spacing } from '@/theme';
import FollowButton from '@/components/profile/FollowButton';

export type FollowerRowSeller = {
  id: string;
  name: string;
  avatar_url: string;
  bio: string | null;
  verified: boolean;
  is_pro: boolean;
};

export type FollowerRowProps = {
  seller: FollowerRowSeller;
  showFollowButton?: boolean;
  onPressRow?: () => void;
};

export function FollowerRow({
  seller,
  showFollowButton = true,
  onPressRow,
}: FollowerRowProps): React.ReactElement {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePressRow = (): void => {
    if (onPressRow) {
      onPressRow();
      return;
    }
    router.push(`/(protected)/seller/${seller.id}` as Href);
  };

  return (
    <Pressable
      onPress={handlePressRow}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t('social.viewProfileAriaLabel', { name: seller.name })}
      style={styles.row}
    >
      <Avatar name={seller.name} uri={seller.avatar_url} size={48} />
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text
            variant="body"
            weight="semibold"
            numberOfLines={1}
            style={styles.name}
          >
            {seller.name}
          </Text>
          {seller.verified ? <VerifiedCheck size={14} /> : null}
          {seller.is_pro ? <ProBadge size="sm" /> : null}
        </View>
        {seller.bio ? (
          <Text
            variant="caption"
            color="secondary"
            numberOfLines={1}
            style={styles.bio}
          >
            {seller.bio}
          </Text>
        ) : null}
      </View>
      {showFollowButton ? (
        <FollowButton
          sellerId={seller.id}
          sellerName={seller.name}
          size="sm"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    flexShrink: 1,
    color: colors.text.primary,
  },
  bio: {
    marginTop: 2,
  },
});

export default FollowerRow;
