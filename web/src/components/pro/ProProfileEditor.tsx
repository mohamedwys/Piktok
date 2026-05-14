'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

/**
 * Minimal seller-profile editor surfaced from Step 2 of the Pro
 * onboarding checklist (Track 7). Bio + location only — anything
 * else (avatar, website, contact methods) is out of scope for the
 * onboarding-completion surface and would belong on a richer profile
 * editor that this track deliberately doesn't ship.
 *
 * On save: POSTs to /api/pro/profile/update, then `router.refresh()`
 * to re-run the parent Server Component's seller fetch (so the form
 * reflects the persisted values), then `router.push('/pro')` so the
 * checklist on the home page can re-evaluate Step 2 with the fresh
 * data. The push uses the locale-aware router from `@/i18n/routing`
 * so locale prefixes are preserved.
 *
 * The two fields are bound to local state seeded with the server
 * values so the user sees their existing bio/location when the page
 * loads. Empty strings are valid input — the API will reject an
 * all-empty patch (no allowed keys) but a partial update (bio only)
 * is fine; Step 2 won't flip to done until BOTH fields are
 * non-empty, which is the user's choice to make.
 */
export function ProProfileEditor({
  initial,
}: {
  initial: { bio: string; locationText: string };
}) {
  const t = useTranslations('pro.profile');
  const router = useRouter();
  const [bio, setBio] = useState(initial.bio);
  const [locationText, setLocationText] = useState(initial.locationText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/pro/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bio.trim(),
          location_text: locationText.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        throw new Error(
          body.details ?? body.error ?? `HTTP ${res.status}`,
        );
      }
      router.refresh();
      router.push('/pro');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="pro-profile-bio"
          className="block text-sm font-semibold text-text-primary"
        >
          {t('fieldBio')}
        </label>
        <textarea
          id="pro-profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="pro-profile-location"
          className="block text-sm font-semibold text-text-primary"
        >
          {t('fieldLocation')}
        </label>
        <input
          id="pro-profile-location"
          type="text"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-feedback-danger">
          {t('saveError', { message: error })}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="md" disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
