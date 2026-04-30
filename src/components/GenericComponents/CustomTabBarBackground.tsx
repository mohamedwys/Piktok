import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const BAR_HEIGHT = 60;
const CUTOUT_RADIUS = 36;

export default function CustomTabBarBackground() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = BAR_HEIGHT + insets.bottom;
  const centerX = width / 2;

  const d = `M 0 0 L ${centerX - CUTOUT_RADIUS} 0 A ${CUTOUT_RADIUS} ${CUTOUT_RADIUS} 0 0 1 ${centerX + CUTOUT_RADIUS} 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path d={d} fill="#0a0a0a" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      </Svg>
    </View>
  );
}
