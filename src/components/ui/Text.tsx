import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native'
import {
  colors,
  textVariants,
  typography,
  type FamilyKey,
  type TextColorKey,
  type TextVariant,
  type WeightKey,
} from '@/theme'

export type TextProps = RNTextProps & {
  variant?: TextVariant
  weight?: WeightKey
  color?: TextColorKey
  family?: FamilyKey
}

const familyForWeight: Record<WeightKey, string> = {
  regular: typography.family.sans,
  medium: typography.family.sansMedium,
  semibold: typography.family.sansSemibold,
  bold: typography.family.sansBold,
}

const displayFamilyForWeight: Record<WeightKey, string> = {
  regular: typography.family.displayRegular,
  medium: typography.family.display,
  semibold: typography.family.displaySemibold,
  bold: typography.family.displaySemibold,
}

const colorForVariant: Record<TextVariant, TextColorKey> = {
  display: 'primary',
  title: 'primary',
  body: 'primary',
  caption: 'secondary',
  label: 'primary',
}

export function Text({
  variant = 'body',
  weight,
  color,
  family,
  style,
  ...rest
}: TextProps) {
  const v = textVariants[variant]
  const resolvedFamily: FamilyKey = family ?? (variant === 'display' ? 'display' : 'sans')
  const resolvedWeight: WeightKey | undefined = weight
  const fontFamily = resolvedWeight
    ? (resolvedFamily === 'display' ? displayFamilyForWeight : familyForWeight)[resolvedWeight]
    : v.family

  const colorKey = color ?? colorForVariant[variant]

  const composed: TextStyle = {
    fontFamily,
    fontSize: v.size,
    lineHeight: v.size * v.lineHeight,
    letterSpacing: v.tracking,
    color: colors.text[colorKey],
    ...(variant === 'label' ? { textTransform: 'uppercase' as const } : null),
  }

  return <RNText {...rest} style={[composed, style]} />
}

export default Text
