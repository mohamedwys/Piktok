import i18n from '@/i18n';

export type LocalizedString = { fr: string; en: string };

export function getLocalized(
  value: LocalizedString | null | undefined,
  lang?: string
): string {
  if (!value) return '';
  const code = (lang ?? i18n.language ?? 'fr').split('-')[0];
  if (code === 'en' && value.en) return value.en;
  if (code === 'fr' && value.fr) return value.fr;
  return value.fr ?? value.en ?? '';
}
