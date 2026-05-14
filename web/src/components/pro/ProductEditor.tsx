'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import type { SellerProductFullRow } from '@/lib/pro/data';

/**
 * Single product editor form (Track 3).
 *
 * Owns the in-progress edit state for one product. On submit, diffs the
 * current form values against the original row and POSTs the patch to
 * `/api/pro/products/[id]/update`. Diffing keeps the request payload
 * small and avoids surfacing untouched columns to the column-level
 * UPDATE grant check on `public.products`.
 *
 * Title is two inputs (FR + EN) bound to title.fr / title.en — the
 * column type is `jsonb` with that shape. Description mirrors the same
 * shape. Stock / shipping labels are kept simple (single text input
 * each, written to the FR field; mobile authoring already duplicates
 * fr+en on insert, so we follow suit).
 *
 * Delete: a confirm() prompt followed by a POST to the dedicated
 * /delete route. On success, router.push back to the list.
 */
type Props = {
  product: SellerProductFullRow;
};

type FormState = {
  titleFr: string;
  titleEn: string;
  description: string;
  price: string;
  currency: 'EUR' | 'USD' | 'GBP';
  purchaseMode: 'buy_now' | 'contact_only';
  stockAvailable: boolean;
  shippingFree: boolean;
  pickupAvailable: boolean;
  location: string;
  dimensions: string;
};

/**
 * Description initial value: products are typically authored with the
 * same string duplicated into fr+en (see mobile `dup()` in sell.ts), so
 * a single textarea suffices for v1. We prefer the locale-matching field
 * to seed, falling back to the other if the matching one is empty.
 */
function initialDescription(
  desc: SellerProductFullRow['description'],
): string {
  if (!desc) return '';
  return desc.fr ?? desc.en ?? '';
}

function initialState(row: SellerProductFullRow): FormState {
  return {
    titleFr: row.title?.fr ?? '',
    titleEn: row.title?.en ?? '',
    description: initialDescription(row.description),
    price: String(row.price),
    currency:
      row.currency === 'USD' || row.currency === 'GBP'
        ? row.currency
        : 'EUR',
    purchaseMode: row.purchase_mode,
    stockAvailable: row.stock_available,
    shippingFree: row.shipping_free,
    pickupAvailable: row.pickup_available,
    location: row.location ?? '',
    dimensions: row.dimensions ?? '',
  };
}

type Patch = Record<string, unknown>;

function buildPatch(
  original: SellerProductFullRow,
  form: FormState,
): Patch {
  const patch: Patch = {};

  const origTitleFr = original.title?.fr ?? '';
  const origTitleEn = original.title?.en ?? '';
  if (form.titleFr !== origTitleFr || form.titleEn !== origTitleEn) {
    patch.title = { fr: form.titleFr, en: form.titleEn };
  }

  const origDesc =
    original.description?.fr ?? original.description?.en ?? '';
  if (form.description !== origDesc) {
    patch.description = { fr: form.description, en: form.description };
  }

  const priceNum = Number(form.price);
  if (Number.isFinite(priceNum) && priceNum !== original.price) {
    patch.price = priceNum;
  }
  if (form.currency !== original.currency) {
    patch.currency = form.currency;
  }
  if (form.purchaseMode !== original.purchase_mode) {
    patch.purchase_mode = form.purchaseMode;
  }
  if (form.stockAvailable !== original.stock_available) {
    patch.stock_available = form.stockAvailable;
  }
  if (form.shippingFree !== original.shipping_free) {
    patch.shipping_free = form.shippingFree;
  }
  if (form.pickupAvailable !== original.pickup_available) {
    patch.pickup_available = form.pickupAvailable;
  }
  if (form.location !== (original.location ?? '')) {
    patch.location = form.location.length > 0 ? form.location : null;
  }
  if (form.dimensions !== (original.dimensions ?? '')) {
    patch.dimensions =
      form.dimensions.length > 0 ? form.dimensions : null;
  }

  return patch;
}

export function ProductEditor({ product }: Props) {
  const t = useTranslations('pro.editor');
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(product));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || deleting) return;
    setError(null);
    setSuccess(null);

    const patch = buildPatch(product, form);
    if (Object.keys(patch).length === 0) {
      setSuccess(t('saveNoChanges'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/pro/products/${product.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSuccess(t('saveSuccess'));
      router.refresh();
    } catch (err) {
      setError(
        t('saveError', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (submitting || deleting) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    setError(null);
    setSuccess(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/pro/products/${product.id}/delete`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push('/pro/products');
    } catch (err) {
      setError(
        t('deleteError', {
          message: err instanceof Error ? err.message : 'unknown',
        }),
      );
      setDeleting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none';
  const labelClass =
    'mb-1 block text-xs uppercase tracking-wide text-text-tertiary';

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-border bg-surface-elevated p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title-fr" className={labelClass}>
            {t('fieldTitleFr')}
          </label>
          <input
            id="title-fr"
            type="text"
            value={form.titleFr}
            onChange={(e) =>
              setForm((s) => ({ ...s, titleFr: e.target.value }))
            }
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="title-en" className={labelClass}>
            {t('fieldTitleEn')}
          </label>
          <input
            id="title-en"
            type="text"
            value={form.titleEn}
            onChange={(e) =>
              setForm((s) => ({ ...s, titleEn: e.target.value }))
            }
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          {t('fieldDescription')}
        </label>
        <textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={(e) =>
            setForm((s) => ({ ...s, description: e.target.value }))
          }
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="price" className={labelClass}>
            {t('fieldPrice')}
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) =>
              setForm((s) => ({ ...s, price: e.target.value }))
            }
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            {t('fieldCurrency')}
          </label>
          <select
            id="currency"
            value={form.currency}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                currency: e.target.value as FormState['currency'],
              }))
            }
            className={inputClass}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('fieldPurchaseMode')}</label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="purchase_mode"
              value="buy_now"
              checked={form.purchaseMode === 'buy_now'}
              onChange={() =>
                setForm((s) => ({ ...s, purchaseMode: 'buy_now' }))
              }
            />
            <span className="text-sm text-text-primary">
              {t('purchaseModeBuyNow')}
            </span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="purchase_mode"
              value="contact_only"
              checked={form.purchaseMode === 'contact_only'}
              onChange={() =>
                setForm((s) => ({ ...s, purchaseMode: 'contact_only' }))
              }
            />
            <span className="text-sm text-text-primary">
              {t('purchaseModeContactOnly')}
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.stockAvailable}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                stockAvailable: e.target.checked,
              }))
            }
          />
          <span className="text-sm text-text-primary">
            {t('fieldStock')}
          </span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.shippingFree}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                shippingFree: e.target.checked,
              }))
            }
          />
          <span className="text-sm text-text-primary">
            {t('fieldShippingFree')}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className={labelClass}>
            {t('fieldLocation')}
          </label>
          <input
            id="location"
            type="text"
            value={form.location}
            onChange={(e) =>
              setForm((s) => ({ ...s, location: e.target.value }))
            }
            className={inputClass}
          />
          <label className="mt-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.pickupAvailable}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  pickupAvailable: e.target.checked,
                }))
              }
            />
            <span className="text-sm text-text-primary">
              {t('fieldPickupAvailable')}
            </span>
          </label>
        </div>
        <div>
          <label htmlFor="dimensions" className={labelClass}>
            {t('fieldDimensions')}
          </label>
          <input
            id="dimensions"
            type="text"
            value={form.dimensions}
            onChange={(e) =>
              setForm((s) => ({ ...s, dimensions: e.target.value }))
            }
            className={inputClass}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-feedback-danger/10 px-4 py-3 text-sm text-feedback-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="rounded-lg bg-feedback-success/10 px-4 py-3 text-sm text-feedback-success"
        >
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={submitting || deleting}
          className="rounded-pill bg-brand px-6 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-pressed disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={submitting || deleting}
          className="rounded-pill border border-feedback-danger px-6 py-2.5 text-sm font-semibold text-feedback-danger hover:bg-feedback-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? t('deleting') : t('delete')}
        </button>
      </div>
    </form>
  );
}
