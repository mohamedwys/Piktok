import Svg, { Path } from 'react-native-svg'
import { colors } from '@/theme'

export type TabBarBackgroundProps = {
  width: number
  height: number
  fillColor?: string
  cutoutCenterX: number
  /** Half-width of the cutout's chord at the top edge. Default 48. */
  cutoutRadius?: number
  /** How deep the curve dips below the top edge. Default 18. */
  cutoutDepth?: number
  /** Top-corner radius. Default 24. */
  cornerRadius?: number
  /** Optional 1px hairline along the top edge for definition over media. */
  showTopHairline?: boolean
}

/**
 * Renders the tab bar's background shape: dark fill, rounded top
 * corners, and a smooth concave cutout at the top center where the
 * Sell FAB nests.
 *
 * Path construction:
 *   - Top corners are explicit cubic Béziers with kappa = 0.5523
 *     (quarter-circle approximation). The earlier SVG `A` arc
 *     command was silently failing to render in this path on iPad —
 *     pure Bézier corners are more reliable across react-native-svg
 *     versions.
 *   - The cutout is two cubic Béziers that meet at the bottom-center,
 *     entering the chord endpoints AND the bottom-center with
 *     horizontal tangents. This produces a smooth U-curve with no
 *     visible kink at the join points.
 */
export function TabBarBackground({
  width,
  height,
  fillColor = colors.surface,
  cutoutCenterX,
  cutoutRadius = 48,
  cutoutDepth = 18,
  cornerRadius = 24,
  showTopHairline = false,
}: TabBarBackgroundProps) {
  const leftX = cutoutCenterX - cutoutRadius
  const rightX = cutoutCenterX + cutoutRadius
  // Control-point distance for the cutout Béziers along their
  // horizontal tangents at the chord endpoints and the bottom-center.
  // 0.55 of the half-width approximates a quarter-circle without
  // overshooting.
  const cp = cutoutRadius * 0.55

  // Quarter-circle Bezier approximation constant for the top corners.
  const KAPPA = 0.5522847498
  const r = cornerRadius
  const cornerHandle = r * (1 - KAPPA)

  const cutoutSegment = [
    `L ${leftX} 0`,
    `C ${leftX + cp} 0 ${cutoutCenterX - cp} ${cutoutDepth} ${cutoutCenterX} ${cutoutDepth}`,
    `C ${cutoutCenterX + cp} ${cutoutDepth} ${rightX - cp} 0 ${rightX} 0`,
  ].join(' ')

  const topLeftCorner =
    `C 0 ${cornerHandle} ${cornerHandle} 0 ${r} 0`
  const topRightCorner =
    `C ${width - cornerHandle} 0 ${width} ${cornerHandle} ${width} ${r}`

  const fillPath = [
    `M 0 ${r}`,
    topLeftCorner,
    cutoutSegment,
    `L ${width - r} 0`,
    topRightCorner,
    `L ${width} ${height}`,
    `L 0 ${height}`,
    'Z',
  ].join(' ')

  const topPath = [
    `M 0 ${r}`,
    topLeftCorner,
    cutoutSegment,
    `L ${width - r} 0`,
    topRightCorner,
  ].join(' ')

  return (
    <Svg width={width} height={height}>
      <Path d={fillPath} fill={fillColor} />
      {showTopHairline ? (
        <Path
          d={topPath}
          stroke={colors.border}
          strokeWidth={1}
          fill="none"
        />
      ) : null}
    </Svg>
  )
}

export default TabBarBackground
