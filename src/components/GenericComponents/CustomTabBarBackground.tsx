import { StyleSheet, View } from 'react-native';

export default function CustomTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
});
