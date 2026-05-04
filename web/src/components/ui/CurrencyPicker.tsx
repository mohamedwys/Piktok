'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Coins } from 'lucide-react';
import {
  CURRENCIES,
  CURRENCY_COOKIE,
  CURRENCY_LABELS,
  type Currency,
} from '@/i18n/currency';

/**
 * Header dropdown for switching the active display currency.
 *
 * Mirrors LanguageSwitcher's shape (Coins icon + active label +
 * chevron, click-outside + Escape close). The two pickers sit
 * side-by-side in the Header so the visitor's preference axes
 * (language and currency) live next to each other.
 *
 * Why a Client Component:
 *   - Owns its open/closed dropdown state.
 *   - Writes the cookie via `document.cookie` (Server-Component
 *     code paths can't write cookies outside Route Handlers /
 *     Server Actions, and we don't want to add a Server Action
 *     just for this — keeping the cookie write client-side is
 *     simpler).
 *
 * Why `router.refresh()` rather than `window.location.reload()`:
 *   - `refresh()` re-fetches the current route's RSC payload from
 *     the server (which re-reads the cookie via `getCurrency()`
 *     in `Pricing`) WITHOUT a full document reload. Client state
 *     (e.g., scroll position, this dropdown's own state) is
 *     preserved. The page just blinks the new prices into place.
 *
 * Cookie write timing: `document.cookie = ...` is synchronous in
 * the browser's cookie jar — subsequent fetch requests (including
 * the RSC fetch issued by `router.refresh()`) carry the new
 * cookie. No race.
 *
 * The picker takes `initial` as a prop so the trigger label
 * matches the server-rendered Pricing card on first paint. The
 * value can drift from the cookie if the user changes the cookie
 * via DevTools, but in practice the picker is the only writer.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function CurrencyPicker({ initial }: { initial: Currency }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Currency>(initial);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape — same shape as
  // LanguageSwitcher.
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

  const handlePick = (next: Currency) => {
    setOpen(false);
    if (next === current) return;

    setCurrent(next);
    // Persist for one year. SameSite=Lax is fine — currency
    // choice isn't sensitive and we don't ship cross-site forms.
    document.cookie =
      `${CURRENCY_COOKIE}=${next}; path=/; ` +
      `max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    // Re-fetch RSC payload so server-rendered prices update.
    router.refresh();
  };

  const activeLabel = CURRENCY_LABELS[current];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change currency"
        className="inline-flex items-center gap-2 rounded-pill px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
      >
        <Coins size={16} aria-hidden />
        <span className="hidden sm:inline">{activeLabel.code}</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Change currency"
          className="absolute end-0 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg"
        >
          {CURRENCIES.map((code) => {
            const isActive = code === current;
            const label = CURRENCY_LABELS[code];
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(code)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-start text-sm transition-colors hover:bg-surface ${
                    isActive ? 'text-brand' : 'text-text-primary'
                  }`}
                >
                  <span className="font-mono text-xs text-text-tertiary">
                    {label.code}
                  </span>
                  <span>{label.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
