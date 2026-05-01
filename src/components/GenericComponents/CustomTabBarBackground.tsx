import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const BAR_HEIGHT = 68;
const CUTOUT_RADIUS = 56;

export default function CustomTabBarBackground() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = BAR_HEIGHT + insets.bottom;
  const cx = width / 2;

  // sweep-flag = 1 → arc sweeps through positive angles (clockwise in y-down),
  // dipping DOWN into the bar's body (positive y). sweep-flag = 0 sends the
  // arc into negative y, which is clipped above the canvas → flat bar.
  const fillPath = `M 0 0 L ${cx - CUTOUT_RADIUS} 0 A ${CUTOUT_RADIUS} ${CUTOUT_RADIUS} 0 0 1 ${cx + CUTOUT_RADIUS} 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
  const topPath = `M 0 0 L ${cx - CUTOUT_RADIUS} 0 A ${CUTOUT_RADIUS} ${CUTOUT_RADIUS} 0 0 1 ${cx + CUTOUT_RADIUS} 0 L ${width} 0`;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path d={fillPath} fill="#0a0a0a" />
        <Path
          d={topPath}
          stroke="rgba(255,255,255,0.20)"
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
    </View>
  );
}
