type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: 'development' | 'preview' | 'production';
};

function required(name: string, raw: string | undefined): string {
  if (!raw || raw.length === 0) {
    throw new Error(
      `[env] Missing ${name}. Add it to .env (dev) and to eas.json env block (build).`,
    );
  }
  return raw;
}

export const env: Env = {
  SUPABASE_URL: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  ENVIRONMENT:
    (process.env.EXPO_PUBLIC_ENVIRONMENT as Env['ENVIRONMENT']) ?? 'development',
};
