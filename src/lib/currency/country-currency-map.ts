import { DEFAULT_CURRENCY } from './constants';

/**
 * ISO 3166-1 alpha-2 country code → ISO 4217 currency code.
 *
 * Used as a fallback when `Localization.getLocales()[0].currencyCode`
 * is missing (rare on real devices — Apple/Android populate this
 * directly per the device's region settings). The 3-tier detection
 * lives in `useDisplayCurrency.detectCurrency()`:
 *
 *   1. Localization.getLocales()[0]?.currencyCode  (authoritative)
 *   2. countryToCurrency(regionCode)               (this map)
 *   3. DEFAULT_CURRENCY                            (final fallback)
 *
 * Coverage: every assigned ISO 3166-1 alpha-2 code (249 entries).
 * Mappings reflect each territory's primary circulating currency
 * as of 2026; exotic dual-currency situations (e.g., Zimbabwe,
 * which legally accepts USD alongside ZWG) resolve to the locally
 * issued currency.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // A
  AD: 'EUR', AE: 'AED', AF: 'AFN', AG: 'XCD', AI: 'XCD',
  AL: 'ALL', AM: 'AMD', AO: 'AOA', AQ: 'USD', AR: 'ARS',
  AS: 'USD', AT: 'EUR', AU: 'AUD', AW: 'AWG', AX: 'EUR',
  AZ: 'AZN',
  // B
  BA: 'BAM', BB: 'BBD', BD: 'BDT', BE: 'EUR', BF: 'XOF',
  BG: 'BGN', BH: 'BHD', BI: 'BIF', BJ: 'XOF', BL: 'EUR',
  BM: 'BMD', BN: 'BND', BO: 'BOB', BQ: 'USD', BR: 'BRL',
  BS: 'BSD', BT: 'BTN', BV: 'NOK', BW: 'BWP', BY: 'BYN',
  BZ: 'BZD',
  // C
  CA: 'CAD', CC: 'AUD', CD: 'CDF', CF: 'XAF', CG: 'XAF',
  CH: 'CHF', CI: 'XOF', CK: 'NZD', CL: 'CLP', CM: 'XAF',
  CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP', CV: 'CVE',
  CW: 'XCG', CX: 'AUD', CY: 'EUR', CZ: 'CZK',
  // D
  DE: 'EUR', DJ: 'DJF', DK: 'DKK', DM: 'XCD', DO: 'DOP',
  DZ: 'DZD',
  // E
  EC: 'USD', EE: 'EUR', EG: 'EGP', EH: 'MAD', ER: 'ERN',
  ES: 'EUR', ET: 'ETB',
  // F
  FI: 'EUR', FJ: 'FJD', FK: 'FKP', FM: 'USD', FO: 'DKK',
  FR: 'EUR',
  // G
  GA: 'XAF', GB: 'GBP', GD: 'XCD', GE: 'GEL', GF: 'EUR',
  GG: 'GBP', GH: 'GHS', GI: 'GIP', GL: 'DKK', GM: 'GMD',
  GN: 'GNF', GP: 'EUR', GQ: 'XAF', GR: 'EUR', GS: 'GBP',
  GT: 'GTQ', GU: 'USD', GW: 'XOF', GY: 'GYD',
  // H
  HK: 'HKD', HM: 'AUD', HN: 'HNL', HR: 'EUR', HT: 'HTG',
  HU: 'HUF',
  // I
  ID: 'IDR', IE: 'EUR', IL: 'ILS', IM: 'GBP', IN: 'INR',
  IO: 'USD', IQ: 'IQD', IR: 'IRR', IS: 'ISK', IT: 'EUR',
  // J
  JE: 'GBP', JM: 'JMD', JO: 'JOD', JP: 'JPY',
  // K
  KE: 'KES', KG: 'KGS', KH: 'KHR', KI: 'AUD', KM: 'KMF',
  KN: 'XCD', KP: 'KPW', KR: 'KRW', KW: 'KWD', KY: 'KYD',
  KZ: 'KZT',
  // L
  LA: 'LAK', LB: 'LBP', LC: 'XCD', LI: 'CHF', LK: 'LKR',
  LR: 'LRD', LS: 'LSL', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  LY: 'LYD',
  // M
  MA: 'MAD', MC: 'EUR', MD: 'MDL', ME: 'EUR', MF: 'EUR',
  MG: 'MGA', MH: 'USD', MK: 'MKD', ML: 'XOF', MM: 'MMK',
  MN: 'MNT', MO: 'MOP', MP: 'USD', MQ: 'EUR', MR: 'MRU',
  MS: 'XCD', MT: 'EUR', MU: 'MUR', MV: 'MVR', MW: 'MWK',
  MX: 'MXN', MY: 'MYR', MZ: 'MZN',
  // N
  NA: 'NAD', NC: 'XPF', NE: 'XOF', NF: 'AUD', NG: 'NGN',
  NI: 'NIO', NL: 'EUR', NO: 'NOK', NP: 'NPR', NR: 'AUD',
  NU: 'NZD', NZ: 'NZD',
  // O
  OM: 'OMR',
  // P
  PA: 'PAB', PE: 'PEN', PF: 'XPF', PG: 'PGK', PH: 'PHP',
  PK: 'PKR', PL: 'PLN', PM: 'EUR', PN: 'NZD', PR: 'USD',
  PS: 'ILS', PT: 'EUR', PW: 'USD', PY: 'PYG',
  // Q
  QA: 'QAR',
  // R
  RE: 'EUR', RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF',
  // S
  SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK',
  SG: 'SGD', SH: 'SHP', SI: 'EUR', SJ: 'NOK', SK: 'EUR',
  SL: 'SLE', SM: 'EUR', SN: 'XOF', SO: 'SOS', SR: 'SRD',
  SS: 'SSP', ST: 'STN', SV: 'USD', SX: 'XCG', SY: 'SYP',
  SZ: 'SZL',
  // T
  TC: 'USD', TD: 'XAF', TF: 'EUR', TG: 'XOF', TH: 'THB',
  TJ: 'TJS', TK: 'NZD', TL: 'USD', TM: 'TMT', TN: 'TND',
  TO: 'TOP', TR: 'TRY', TT: 'TTD', TV: 'AUD', TW: 'TWD',
  TZ: 'TZS',
  // U
  UA: 'UAH', UG: 'UGX', UM: 'USD', US: 'USD', UY: 'UYU',
  UZ: 'UZS',
  // V
  VA: 'EUR', VC: 'XCD', VE: 'VES', VG: 'USD', VI: 'USD',
  VN: 'VND', VU: 'VUV',
  // W
  WF: 'XPF', WS: 'WST',
  // Y
  YE: 'YER', YT: 'EUR',
  // Z
  ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWG',
};

/**
 * Map a country code (ISO 3166-1 alpha-2, case-insensitive) to
 * its primary circulating currency. Returns DEFAULT_CURRENCY
 * for unknown / null / empty inputs.
 */
export function countryToCurrency(
  country: string | null | undefined,
): string {
  if (!country) return DEFAULT_CURRENCY;
  const upper = country.toUpperCase();
  return COUNTRY_CURRENCY_MAP[upper] ?? DEFAULT_CURRENCY;
}
