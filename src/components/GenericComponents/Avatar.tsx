import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

const PALETTE = [colors.brand, '#7C5CFC', '#3b9eff', '#33D17A', '#FFC83D', '#FF8A3D', '#E64980'];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

type Props = {
  name: string;
  uri?: string;
  size?: number;
};

export default function Avatar({ name, uri, size = 36 }: Props): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && uri.length > 0 && !failed;
  const radius = size / 2;
  const fontSize = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: showImage ? '#222' : colorFromName(name),
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, { fontSize }]}>{initialOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#fff', fontWeight: '800' },
});
