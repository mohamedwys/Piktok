// deno-lint-ignore-file
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

type PushBody = {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const payload = (await req.json()) as PushBody;
    if (!payload.user_id || !payload.title || !payload.body) {
      return new Response('Missing fields', { status: 400, headers: corsHeaders });
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
