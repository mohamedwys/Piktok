// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Phase 6 / B3: replace `*` with an explicit allow-list. Mobile clients
// use the Supabase JS SDK which does NOT send an Origin header in native
// runtimes; `allowOrigin` is empty in that case, which is fine because
// the browser CORS check does not run on native. Browser callers from
// any of the listed origins receive their own origin echoed back.
const ALLOWED_ORIGINS = new Set([
  'https://mony.app',
  'https://mony-psi.vercel.app',
  'http://localhost:3000',
]);

type PushBody = {
  conversation_id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(reqOrigin) ? reqOrigin : '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const payload = (await req.json()) as PushBody;
    if (
      !payload.conversation_id ||
      !payload.user_id ||
      !payload.title ||
      !payload.body
    ) {
      return new Response('Missing fields', { status: 400, headers: corsHeaders });
    }

    // Phase 6 / B1: refuse arbitrary user_id targets. The caller must
    // (a) be a participant of the named conversation, and (b) name the
    // OTHER participant as the recipient. This collapses the previous
    // "send a push to any user_id" primitive into "send a push to the
    // peer of a conversation I'm in".
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('buyer_id, seller_user_id')
      .eq('id', payload.conversation_id)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv) {
      return new Response('Conversation not found', { status: 404, headers: corsHeaders });
    }

    const me = user.id;
    const isParticipant = conv.buyer_id === me || conv.seller_user_id === me;
    if (!isParticipant) {
      return new Response('Not a participant', { status: 403, headers: corsHeaders });
    }

    const peer = conv.buyer_id === me ? conv.seller_user_id : conv.buyer_id;
    if (peer !== payload.user_id) {
      return new Response('recipient_mismatch', { status: 403, headers: corsHeaders });
    }

    const { data: tokens, error: tErr } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', payload.user_id);
    if (tErr) throw tErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await resp.json();

    return new Response(JSON.stringify({ sent: tokens.length, expo: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push-notification error', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
