'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function SignInForm({ next }: { next: string }) {
  const t = useTranslations('signIn');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const supabase = getSupabaseBrowser();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (otpError) {
      setStatus('error');
      setError(otpError.message);
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center space-y-3">
        <h2 className="font-display text-xl font-semibold">{t('checkEmailTitle')}</h2>
        <p className="text-text-secondary">{t('checkEmailBody', { email })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-text-secondary">{t('emailLabel')}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-2 block w-full rounded-md border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:border-brand"
        />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button
        type="submit"
        variant="outline"
        size="md"
        className="w-full"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? t('sending') : t('cta')}
      </Button>
    </form>
  );
}
