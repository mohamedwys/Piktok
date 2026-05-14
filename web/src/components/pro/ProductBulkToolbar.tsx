'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

/**
 * Bulk-action toolbar (Track 3).
 *
 * Renders the count of selected products and two purchase_mode toggle
 * actions. Each action POSTs `{ ids, patch: { purchase_mode } }` to
 * /api/pro/products/bulk-update; the route fans out N atomic per-row
 * updates and reports `{ updated, failed }`. On success we refresh the
 * Server Component above so the table re-renders with the new status
 * pills, then clear the selection.
 *
 * Partial failures: the toolbar surfaces a partial-success message
 * ("updated X, Y failed") rather than failing the whole batch. The
 * per-row failures are not shown individually in v1 — they typically
 * indicate the row no longer exists or RLS denied (e.g., seller_id
 * changed during the request). A future iteration could expand the
 * details inline.
 */
type Props = {
  selectedIds: string[];
  onClear: () => void;
};

type Result =
  | { kind: 'idle' }
  | { kind: 'success'; updated: number; failed: number }
  | { kind: 'error'; message: string };

export function ProductBulkToolbar({ selectedIds, onClear }: Props) {
  const t = useTranslations('pro.products');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  const run = async (mode: 'buy_now' | 'contact_only') => {
    if (submitting) return;
    setSubmitting(true);
    setResult({ kind: 'idle' });
    try {
      const res = await fetch('/api/pro/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          patch: { purchase_mode: mode },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        updated: number;
        failed: { id: string; error: string }[];
      };
      setResult({
        kind: 'success',
        updated: body.updated,
        failed: body.failed.length,
      });
      router.refresh();
      onClear();
    } catch (err) {
      setResult({
        kind: 'error',
        message: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-text-primary">
          {t('selectionCount', { count: selectedIds.length })}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => run('buy_now')}
            className="rounded-pill bg-brand px-4 py-1.5 text-sm font-semibold text-brand-text hover:bg-brand-pressed disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('bulkEnableBuyNow')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => run('contact_only')}
            className="rounded-pill border border-border-strong bg-surface px-4 py-1.5 text-sm font-semibold text-text-primary hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('bulkDisableBuyNow')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onClear}
            className="rounded-pill px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            {t('bulkCancel')}
          </button>
        </div>
      </div>

      {result.kind === 'success' ? (
        <p
          role="status"
          className="mt-3 text-sm text-feedback-success"
        >
          {result.failed === 0
            ? t('bulkResultSuccess', { count: result.updated })
            : t('bulkResultPartial', {
                updated: result.updated,
                failed: result.failed,
              })}
        </p>
      ) : null}
      {result.kind === 'error' ? (
        <p role="alert" className="mt-3 text-sm text-feedback-danger">
          {t('bulkResultError', { message: result.message })}
        </p>
      ) : null}
    </div>
  );
}
