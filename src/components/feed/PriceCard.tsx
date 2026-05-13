import React from 'react'
import { View } from 'react-native'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import {
  BulletDot,
  GlassCard,
  IconButton,
  Text,
} from '@/components/ui'
import { colors, spacing } from '@/theme'
import { useFormatDisplayPrice } from '@/hooks/useFormatDisplayPrice'

export type PriceCardProps = {
  amount: number
  currency?: string
  inStock: boolean
  freeShipping: boolean
  isSaved: boolean
  onToggleSave: () => void
}

export function PriceCard({
  amount,
  currency = 'EUR',
  inStock,
  freeShipping,
  isSaved,
  onToggleSave,
}: PriceCardProps) {
  const { t } = useTranslation()
  const fmt = useFormatDisplayPrice()
  return (
    <GlassCard
      variant="dark"
      radius="xl"
      padding="md"
      // Cap the card on iPad/tablet so it doesn't grow with viewport.
      // ProductFeedItem already lays this out as a flex-shrink:0 child;
      // the cap is preventive against future layout changes.
      style={{ maxWidth: 320, flexShrink: 1 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text variant="title" weight="semibold">
          {fmt(amount, currency)}
        </Text>
        <IconButton
          variant="ghost"
          size="sm"
          icon={
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={colors.text.primary}
            />
          }
          onPress={onToggleSave}
          accessibilityLabel={
            isSaved
              ? t('marketplace.removeBookmark')
              : t('marketplace.addBookmark')
          }
        />
      </View>

      {inStock ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.sm,
          }}
        >
          <BulletDot size={6} color={colors.feedback.success} />
          <Text variant="caption" color="secondary">
            {t('marketplace.inStock')}
          </Text>
        </View>
      ) : null}

      {freeShipping ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: 2,
          }}
        >
          <MaterialIcons
            name="local-shipping"
            size={14}
            color={colors.text.secondary}
          />
          <Text variant="caption" color="secondary">
            {t('marketplace.freeShipping')}
          </Text>
        </View>
      ) : null}
    </GlassCard>
  )
}

export default React.memo(PriceCard, (prev, next) => {
  return (
    prev.amount === next.amount &&
    prev.currency === next.currency &&
    prev.inStock === next.inStock &&
    prev.freeShipping === next.freeShipping &&
    prev.isSaved === next.isSaved
  )
})
