import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, type ChipSize } from '@/components/ui';
import { useRequireAuth } from '@/stores/useRequireAuth';
import {
  useUserEngagement,
  useToggleFollow,
} from '@/features/marketplace';

export type FollowButtonProps = {
  sellerId: string;
  sellerName?: string;
  size?: ChipSize;
  onPress?: () => void;
};

export function FollowButton({
  sellerId,
  sellerName,
  size = 'md',
  onPress,
}: FollowButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const { requireAuth } = useRequireAuth();
  const { data: engagement } = useUserEngagement();
  const toggleFollow = useToggleFollow();

  const isFollowing = engagement?.followingSellerIds.has(sellerId) ?? false;

  const handlePress = (): void => {
    if (!requireAuth()) return;
    toggleFollow.mutate({ sellerId, currentlyFollowing: isFollowing });
    onPress?.();
  };

  const accessibilityLabel = sellerName
    ? isFollowing
      ? t('social.unfollowAriaLabel', { name: sellerName })
      : t('social.followAriaLabel', { name: sellerName })
    : isFollowing
      ? t('social.following')
      : t('social.follow');

  return (
    <Chip
      label={isFollowing ? t('social.following') : t('social.follow')}
      variant={isFollowing ? 'outlined' : 'filled'}
      size={size}
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export default FollowButton;
