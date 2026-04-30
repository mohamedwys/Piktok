import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function CategoriesScreen(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{t('categories.title')}</Text>
      <Ionicons
        name="grid-outline"
        size={48}
        color="rgba(255,255,255,0.25)"
        style={styles.icon}
      />
      <Text style={styles.hint}>{t('categories.emptyHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  icon: {
    alignSelf: 'center',
    marginTop: 60,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 16,
  },
});
