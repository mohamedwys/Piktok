import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayPrice } from '@/lib/format';
import { useDisplayCurrency } from '@/stores/useDisplayCurrency';
import { useExchangeRates } from '@/stores/useExchangeRates';

export type FormatDisplayPrice = (
  amount: number,
  productCurrency?: string,
) => string;

/**
 * Composition hook returning a memoized formatter that converts
 * (amount, productCurrency) pairs to the user's preferred display
 * currency, using cached rates and the active i18n locale.
 *
 * Re-renders when display currency, rates snapshot, or i18n
 * language changes — components consuming this hook automatically
 * pick up rate refreshes and override toggles.
 *
 * Usage (H'.3 call sites):
 *   const fmt = useFormatDisplayPrice();
 *   <Text>{fmt(product.price, product.currency)}</Text>
 */
export function useFormatDisplayPrice(): FormatDisplayPrice {
  const displayCurrency = useDisplayCurrency((s) => s.currency);
  const rates = useExchangeRates((s) => s.snapshot?.rates ?? null);
  const { i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';

  return useCallback(
    (amount, productCurrency = 'EUR') =>
      formatDisplayPrice(
        amount,
        productCurrency,
        displayCurrency,
        locale,
        rates,
      ),
    [displayCurrency, rates, locale],
  );
}
