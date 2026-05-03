import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  BulletDot,
  GlassCard,
  Pressable,
  ProBadge,
  Text,
  VerifiedCheck,
} from '@/components/ui'
import { colors, spacing } from '@/theme'
import { formatCount } from '@/lib/format'

export type SellerPillSeller = {
  id: string
  name: string
  avatarUrl?: string
  verified: boolean
  isPro: boolean
  rating: number
  ratingCount: number
  salesCount: number
}

export type SellerPillProps = {
  seller: SellerPillSeller
  onPress?: () => void
}

export function SellerPill({ seller, onPress }: SellerPillProps) {
  const { t, i18n } = useTranslation()
  const ratingText = seller.rating.toLocaleString(
    i18n.language === 'fr' ? 'fr-FR' : i18n.language,
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )
  const salesUnit = t('marketplace.salesUnit', { count: seller.salesCount })

  // All visual sizes here mirror the legacy SellerCard at
  // src/features/marketplace/components/SellerCard.tsx so this
  // component renders at the same footprint users were used to
  // before Step 4. Cited line numbers are in that legacy file.
  const card = (
    <GlassCard
      variant="dark"
      radius="legacy" // legacy line 68: borderRadius: 14
      // padding from legacy line 77; maxWidth caps the pill on iPad/tablet
      // so it stops growing with viewport while staying compact on phone.
      style={{ padding: spacing[10], maxWidth: 320, flexShrink: 1 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[10], // legacy line 76: gap: 10
        }}
      >
        <Avatar
          source={seller.avatarUrl ? { uri: seller.avatarUrl } : undefined}
          name={seller.name}
          diameter={36} // legacy line 34: <Avatar size={36}>
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs, // legacy line 93: verifiedIcon marginLeft: 4
            }}
          >
            <Text
              variant="body"
              weight="bold"
              numberOfLines={1}
              // legacy lines 88-89: fontSize: 14, fontWeight: '700'
              style={{ flexShrink: 1, fontSize: 14, lineHeight: 18 }}
            >
              {seller.name}
            </Text>
            {seller.verified ? <VerifiedCheck size={14} /> : null}
          </View>

          {seller.isPro ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <ProBadge size="sm" label={t('marketplace.proBadge')} />
              <Text
                variant="caption"
                color="secondary"
                numberOfLines={1}
                // Match legacy line 110: fontSize: 12 + tight lineHeight
                style={{ fontSize: 12, lineHeight: 16 }}
              >
                {t('marketplace.sellerPro')}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Ionicons name="star" size={12} color={colors.text.primary} />
            <Text
              variant="caption"
              color="secondary"
              numberOfLines={1}
              // legacy line 110: fontSize: 12
              style={{ fontSize: 12, lineHeight: 16 }}
            >
              {`${ratingText} (${formatCount(seller.ratingCount, i18n.language)})`}
            </Text>
            <BulletDot />
            <Text
              variant="caption"
              color="secondary"
              numberOfLines={1}
              // legacy line 110: fontSize: 12
              style={{ fontSize: 12, lineHeight: 16 }}
            >
              {`${formatCount(seller.salesCount, i18n.language)} ${salesUnit}`}
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  )

  if (!onPress) {
    return card
  }

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t('seller.viewShop', { name: seller.name })}
    >
      {card}
    </Pressable>
  )
}

export default SellerPill
