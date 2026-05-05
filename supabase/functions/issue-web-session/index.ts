// deno-lint-ignore-file
//
// =============================================================================
// Edge Function: issue-web-session
// Purpose:       Mint a single-use Supabase magic-link URL for the calling
//                authenticated mobile user. The mobile client opens the URL
//                in an in-app browser (expo-web-browser) and the web app
//                receives the user already-authenticated — no second
//                login prompt at the Pro upgrade dashboard.
//
//                Per PRO_AUDIT.md §8.4 option A: a tiny dedicated Edge
//                Function over the alternative (cookie / Universal Link
//                bridge) because the magic-link approach is Supabase-native,
//                requires zero custom JWT signing, and respects Supabase
//                Auth's redirect allowlist as the security boundary.
//
// Auth model:    The function MUST verify the caller's identity from the
//                Authorization header BEFORE generating a link. The
//                magic-link is issued for the verified user's `email`. An
//                unauthenticated caller cannot mint links for arbitrary
//                emails — that would be an account-takeover vector since
//                magic-links bypass passwords. The function uses the
//                service-role key (server-side only — never exposed to the
//                client) for the admin generateLink() call, but the email
//                argument always comes from the verified JWT.
//
// Redirect:     `redirect_to` is a relative path on the web app, defaulted
//                to `/upgrade`. The function resolves it against the
//                `WEB_BASE_URL` secret to build the absolute URL passed to
//                Supabase as `options.redirectTo`. The destination must
//                also be allow-listed in Supabase Dashboard →
//                Authentication → URL Configuration → "Additional Redirect
//                URLs" (one-time setup; see Manual Setup section in the
//                H.5 changelog).
//
// Style:        Matches the existing `send-push-notification` and
//                `create-checkout-session` Edge Functions verbatim:
//                  - `// deno-lint-ignore-file` header
//                  - `https://esm.sh/...` imports
//                  - Module-level supabase admin client
//                  - corsHeaders shape
//                  - Plain-string 4xx responses, JSON 5xx
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_REDIRECT_PATH = '/upgrade';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Verify the caller is authenticated. Refuse anonymous callers
    //    — service-role admin access without auth verification would
    //    let any anonymous request mint magic-links for any email.
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (!user || !user.email) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // 2. Resolve the redirect target. `redirect_to` is an optional
    //    relative path; we whitelist by requiring it to start with `/`
    //    so a malicious caller cannot redirect off the web app domain.
    let redirectPath = DEFAULT_REDIRECT_PATH;
    try {
      const body = await req.json();
      if (typeof body?.redirect_to === 'string' && body.redirect_to.startsWith('/')) {
        redirectPath = body.redirect_to;
      }
    } catch {
      // Empty / invalid JSON body is fine — fall back to the default path.
    }

    const webBaseUrl = Deno.env.get('WEB_BASE_URL') ?? 'https://mony-psi.vercel.app';
    // Route through /auth/callback so @supabase/ssr can exchange the
    // token_hash for a cookie-based session before forwarding to `next`.
    const callbackUrl = new URL('/auth/callback', webBaseUrl);
    callbackUrl.searchParams.set('next', redirectPath);
    const fullRedirect = callbackUrl.toString();

    // 3. Generate the magic link. `type: 'magiclink'` issues a single-use,
    //    time-limited (1h default) link signed by Supabase Auth. The
    //    returned `properties.action_link` is the URL the mobile client
    //    opens in the in-app browser; navigating it logs the user in and
    //    redirects to `redirectTo`.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo: fullRedirect },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error(linkErr?.message ?? 'link_generation_failed');
    }

    return new Response(
      JSON.stringify({ url: linkData.properties.action_link }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('issue-web-session error', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
