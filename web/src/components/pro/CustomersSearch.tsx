'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * Customers list search input (Track 5).
 *
 * URL state is the source of truth — same posture as OrderFilters. The
 * page Server Component reads `?q` and renders the filtered table; this
 * component pushes URL updates on typing (debounced 500ms) and on
 * explicit submit. The useEffect re-sync handles back/forward where the
 * URL changes externally.
 *
 * Single input, no other controls — the customers list doesn't currently
 * have status/date facets to combine with. If those ship later, the
 * shape lifts toward OrderFilters; for now the focused affordance keeps
 * the surface clean.
 */
export function CustomersSearch({ q }: { q: string }) {
  const t = useTranslations('pro.customers');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    setQInput(q);
  }, [q]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHref = useCallback(
    (value: string): string => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === '') {
        sp.delete('q');
      } else {
        sp.set('q', value);
      }
      const qs = sp.toString();
      return qs.length > 0 ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  const pushNow = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      router.push(buildHref(value));
    },
    [router, buildHref],
  );

  const pushDebounced = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.push(buildHref(value));
      }, 500);
    },
    [router, buildHref],
  );

  const onChange = (value: string) => {
    setQInput(value);
    pushDebounced(value);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    pushNow(qInput);
  };

  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <input
        type="search"
        value={qInput}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('search.placeholder')}
        className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
      />
    </form>
  );
}
