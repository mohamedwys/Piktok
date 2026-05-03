import React from 'react';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Chip, type ChipSize } from '@/components/ui';
import { colors } from '@/theme';
import { useRequireAuth } from '@/stores/useRequireAuth';

// The existing messaging RPC `start_or_get_conversation(p_product_id uuid)`
// at supabase/migrations/20260509_messaging.sql:88-128 is product-scoped —
// every conversation belongs to a (product, buyer) pair. The seller profile
// has no product context, so a "DM this seller" affordance has no entry
// point in the current backend. C.4 ships the button visually but routes
// it to a "coming soon" Alert. Wiring is deferred to a future phase that
// adds a per-seller (product-less) conversation path.
export type MessageButtonProps = {
  sellerId: string;
  sellerName?: string;
  size?: ChipSize;
};

export function MessageButton({
  sellerName,
  size = 'md',
}: MessageButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const { requireAuth } = useRequireAuth();

  const handlePress = (): void => {
    if (!requireAuth()) return;
    Alert.alert(
      t('social.messageComingSoonTitle'),
      sellerName
        ? t('social.messageComingSoonBodyNamed', { name: sellerName })
        : t('social.messageComingSoonBody'),
    );
  };

  const accessibilityLabel = sellerName
    ? t('social.messageAriaLabel', { name: sellerName })
    : t('social.message');

  return (
    <Chip
      label={t('social.message')}
      leadingIcon={
        <Ionicons name="chatbubble-outline" size={14} color={colors.text.primary} />
      }
      variant="outlined"
      size={size}
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export default MessageButton;
