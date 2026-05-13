import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { mmkvSync } from '@shared/storage/mmkv';
import fr from './locales/fr.json';
import en from './locales/en.json';

const STORAGE_KEY = 'user.language';
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function detectInitialLanguage(): SupportedLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? 'fr';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : 'fr';
}

export async function initI18n(): Promise<void> {
  const stored = mmkvSync.getString(STORAGE_KEY);
  const initial =
    stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)
      ? (stored as SupportedLanguage)
      : detectInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: initial,
    fallbackLng: 'fr',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
  });
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  mmkvSync.setString(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
