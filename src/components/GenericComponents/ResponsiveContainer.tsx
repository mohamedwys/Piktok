import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function ResponsiveContainer({
  children,
  style,
}: Props): React.ReactElement {
  const { contentMaxWidth, isTablet } = useDeviceLayout();
  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.inner,
          isTablet ? { maxWidth: contentMaxWidth } : null,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  inner: { flex: 1, width: '100%', alignSelf: 'center' },
});
