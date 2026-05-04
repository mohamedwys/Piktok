'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { routing } from '@/i18n/routing';

/**
 * Header dropdown for switching the active locale.
 *
 * Client Component because it owns its open/closed dropdown
 * state. Tap the trigger button → list of locales appears →
 * selecting one calls `router.replace(pathname, { locale })`.
 * next-intl's locale-aware router preserves the current path
 * segment while swapping the locale prefix and writes the
 * NEXT_LOCALE cookie so the choice sticks across visits.
 *
 * The dropdown closes on:
 *   - Selecting a locale.
 *   - Clicking outside.
 *   - Pressing Escape.
 *
 * The trigger label shows the active locale's native-name label
 * (e.g., "Français" not "FR-FR" — clearer for non-English
 * speakers spotting their language).
 */
type LocaleOption = { code: (typeof routing.locales)[number]; label: string };

const LOCALES: LocaleOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape — standard dropdown UX.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const handlePick = (code: LocaleOption['code']) => {
    setOpen(false);
    if (code === locale) return;
    router.replace(pathname, { locale: code });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('ariaLabel')}
        className="inline-flex items-center gap-2 rounded-pill px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
      >
        <Globe size={16} aria-hidden />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t('ariaLabel')}
          className="absolute end-0 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg"
        >
          {LOCALES.map((option) => {
            const isActive = option.code === locale;
            return (
              <li key={option.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(option.code)}
                  className={`w-full px-4 py-2 text-start text-sm transition-colors hover:bg-surface ${
                    isActive
                      ? 'text-brand'
                      : 'text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
