'use client';

import { useTranslations } from 'next-intl';

/**
 * Country dropdown for /pro/payouts not_started state (Track F.C.2).
 *
 * Native <select>, no combobox library — there are 14 options total and
 * a styled native select is faster, accessible by default, and avoids
 * pulling in a popover dependency for a single use.
 *
 * The 14-country allow-list mirrors the F.C.1 server-side allow-list
 * exactly (`create-account-link/index.ts §ALLOWED_COUNTRIES`). Adding
 * a country here without adding it server-side would surface as a
 * 400 `country_not_supported` from the API; the server is the source
 * of truth.
 *
 * Country labels are localized via `pro.payouts.country.<ISO>`. The
 * select stays a controlled component owned by the parent so the
 * onboard button can read the current value at click time without
 * crossing a context.
 */
export const CONNECT_ALLOWED_COUNTRIES = [
  'FR',
  'BE',
  'CH',
  'LU',
  'MC',
  'GB',
  'IE',
  'DE',
  'NL',
  'IT',
  'ES',
  'PT',
  'US',
  'CA',
] as const;

export type ConnectCountry = (typeof CONNECT_ALLOWED_COUNTRIES)[number];

export function ConnectCountryPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ConnectCountry;
  onChange: (next: ConnectCountry) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('pro.payouts');

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-text-primary">{t('countryLabel')}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ConnectCountry)}
        className="rounded-lg border border-border-strong bg-surface-elevated px-3 py-2.5 text-base text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
      >
        {CONNECT_ALLOWED_COUNTRIES.map((iso) => (
          <option key={iso} value={iso}>
            {t(`country.${iso}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
