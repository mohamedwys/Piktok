import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n';
import { lightHaptic } from '@/features/marketplace/utils/haptics';

const BRAND_PRIMARY = '#FE2C55';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

export default function ProfileScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const currentLang = i18n.language as SupportedLanguage;

  const onPressLang = (lang: SupportedLanguage): void => {
    if (lang === currentLang) return;
    void lightHaptic();
    void setLanguage(lang);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.settings')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.language')}</Text>
            <View style={styles.pillRow}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = lang === currentLang;
                return (
                  <Pressable
                    key={lang}
                    onPress={() => onPressLang(lang)}
                    style={({ pressed }) => [
                      styles.pill,
                      isActive ? styles.pillActive : styles.pillInactive,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive ? styles.pillTextActive : styles.pillTextInactive,
                      ]}
                    >
                      {LANGUAGE_LABELS[lang]}
                    </Text>
                    {isActive ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#fff"
                        style={styles.pillIcon}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    gap: 10,
  },
  rowLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: BRAND_PRIMARY,
  },
  pillInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  pillTextInactive: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  pillIcon: {
    marginLeft: 6,
  },
});
