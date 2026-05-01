import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ResponsiveContainer from '@/components/GenericComponents/ResponsiveContainer';

export default function MessagesScreen(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ResponsiveContainer style={{ paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
      <Text style={styles.title}>{t('messages.title')}</Text>
      <Ionicons
        name="chatbubbles-outline"
        size={48}
        color="rgba(255,255,255,0.25)"
        style={styles.icon}
      />
      <Text style={styles.empty}>{t('messages.empty')}</Text>
      <Text style={styles.hint}>{t('messages.emptyHint')}</Text>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  icon: {
    alignSelf: 'center',
    marginTop: 60,
  },
  empty: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
  },
});
