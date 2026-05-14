// deno-lint-ignore-file
//
// validate-iap-receipt — Phase 8 / Track A
//
// Validates Apple StoreKit receipts and Google Play Billing purchase tokens
// for the Pro subscription, then upserts the public.subscriptions row.
// The handle_subscription_change trigger (20260522) flips sellers.is_pro
// downstream when status='active'. Append-only audit row is also written
// to public.iap_receipts.
//
// Auth: caller's JWT verified via supabase.auth.getUser(authHeader).
// Idempotency: server upserts ON CONFLICT (apple_transaction_id) or
//   ON CONFLICT (google_purchase_token). Repeat deliveries (e.g., the
//   restore-purchases launch flow) collapse to a single row per receipt.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   - APPLE_SHARED_SECRET                   (ASC app-specific shared secret)
//   - APPLE_BUNDLE_ID                       ('com.pictok.client')
//   - GOOGLE_PLAY_PACKAGE_NAME              ('com.pictok.client')
//   - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON      (full JSON string)
//
// See docs/store/iap-setup-checklist.md for the manual setup steps.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initEdgeSentry, captureEdgeException } from '../_shared/sentry.ts';

initEdgeSentry();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_ORIGINS = new Set([
  'https://mony.app',
  'https://mony-psi.vercel.app',
  'http://localhost:3000',
]);

type IOSReceipt = {
  status: number;
  receipt?: {
    in_app?: Array<{
      product_id: string;
      transaction_id: string;
      original_transaction_id: string;
      expires_date_ms?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    original_transaction_id: string;
    expires_date_ms: string;
  }>;
};

type AndroidSubscription = {
  expiryTimeMillis: string;
  purchaseState?: number;       // 0 = purchased
  autoRenewing?: boolean;
  orderId?: string;
};

async function verifyApple(receipt: string): Promise<IOSReceipt> {
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET') ?? '';
  const body = JSON.stringify({
    'receipt-data': receipt,
    password: sharedSecret,
    'exclude-old-transactions': true,
  });
  // Try production first. Apple's verifyReceipt returns status=21007 when
  // a sandbox receipt is sent to the production endpoint — in that case
  // the spec is to retry against sandbox.
  const prod = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const prodJson = await prod.json() as IOSReceipt;
  if (prodJson.status === 21007) {
    const sandbox = await fetch(
      'https://sandbox.itunes.apple.com/verifyReceipt',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );
    return await sandbox.json() as IOSReceipt;
  }
  return prodJson;
}

async function getGoogleAccessToken(): Promise<string> {
  const svcJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!svcJson) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set');
  const svc = JSON.parse(svcJson) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };

  // Build a signed JWT (RS256). Deno's SubtleCrypto handles RSA-PKCS1-v1_5.
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: svc.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const base64url = (data: Uint8Array | string): string => {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;
    return btoa(String.fromCharCode(...bytes))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the PEM private key (PKCS#8). The JSON string carries literal
  // newlines inside private_key; strip the PEM armor and decode the
  // base64 body.
  const pemContents = svc.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${signingInput}.${signatureB64}`;

  const tokenResp = await fetch(svc.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenResp.json();
  if (!tokenJson.access_token) {
    throw new Error('google_oauth_failed: ' + JSON.stringify(tokenJson));
  }
  return tokenJson.access_token as string;
}

async function verifyGoogle(
  productId: string,
  purchaseToken: string,
): Promise<AndroidSubscription> {
  const pkg = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') ?? 'com.pictok.client';
  const accessToken = await getGoogleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new Error('google_verify_failed: ' + await resp.text());
  }
  return await resp.json() as AndroidSubscription;
}

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
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  // Hoisted so the catch block can include them in the Sentry capture.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  let platform: 'ios' | 'android' | undefined;
  let productId: string | undefined;
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const authRes = await supabase.auth.getUser(auth);
    user = authRes.data.user;
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const body = await req.json() as {
      platform: 'ios' | 'android';
      receipt: string;
      product_id: string;
    };
    if (!body.platform || !body.receipt || !body.product_id) {
      return new Response('Missing fields', { status: 400, headers: corsHeaders });
    }
    platform = body.platform;
    productId = body.product_id;

    // Resolve seller_id. If the user has no sellers row yet (rare —
    // signup creates one — but possible if account was reset), promote
    // via the existing get_or_create RPC.
    const { data: sellerRow } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!sellerRow) {
      await supabase.rpc('get_or_create_seller_for_current_user', {
        p_username: (user.user_metadata?.username as string | undefined) ?? 'User',
        p_avatar_url: '',
      });
    }
    const { data: sellerRowAfter } = await supabase
      .from('sellers').select('id').eq('user_id', user.id).maybeSingle();
    if (!sellerRowAfter) {
      return new Response('seller_resolve_failed', { status: 500, headers: corsHeaders });
    }
    const sellerId = sellerRowAfter.id as string;

    let valid = false;
    let transactionId: string | null = null;
    let originalTransactionId: string | null = null;
    let expiresAt: Date | null = null;
    let rawResponse: Record<string, unknown> = {};

    if (body.platform === 'ios') {
      const apple = await verifyApple(body.receipt);
      rawResponse = apple as unknown as Record<string, unknown>;
      if (apple.status === 0) {
        const latest = apple.latest_receipt_info?.[0]
          ?? apple.receipt?.in_app?.[0];
        if (latest) {
          transactionId = latest.transaction_id;
          originalTransactionId = latest.original_transaction_id;
          const msStr = (latest as { expires_date_ms?: string }).expires_date_ms;
          if (msStr) expiresAt = new Date(Number(msStr));
          valid = !!expiresAt && expiresAt.getTime() > Date.now();
        }
      }
    } else {
      const google = await verifyGoogle(body.product_id, body.receipt);
      rawResponse = google as unknown as Record<string, unknown>;
      transactionId = google.orderId ?? body.receipt;
      expiresAt = new Date(Number(google.expiryTimeMillis));
      valid = expiresAt.getTime() > Date.now();
    }

    // Audit log — written for every attempt, valid or not.
    await supabase.from('iap_receipts').insert({
      user_id: user.id,
      platform: body.platform,
      raw_receipt: body.receipt,
      transaction_id: transactionId,
      original_transaction_id: originalTransactionId,
      product_id: body.product_id,
      expires_at: expiresAt?.toISOString() ?? null,
      verification_status: valid
        ? 'valid'
        : (expiresAt && expiresAt.getTime() <= Date.now() ? 'expired' : 'invalid'),
      raw_response: rawResponse,
    });

    if (!valid) {
      return new Response(
        JSON.stringify({ error: 'invalid_receipt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Upsert the subscriptions row. On iOS we key by original_transaction_id
    // (stable across renewals); on Android by purchaseToken.
    const conflictColumn = body.platform === 'ios'
      ? 'apple_transaction_id'
      : 'google_purchase_token';
    const upsertRow = {
      seller_id: sellerId,
      status: 'active',
      payment_provider: body.platform === 'ios' ? 'apple_iap' : 'google_play',
      apple_transaction_id: body.platform === 'ios'
        ? (originalTransactionId ?? transactionId)
        : null,
      google_purchase_token: body.platform === 'android' ? body.receipt : null,
      current_period_end: expiresAt!.toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: upsertErr } = await supabase
      .from('subscriptions')
      .upsert(upsertRow, { onConflict: conflictColumn });
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ status: 'active', expires_at: expiresAt!.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('validate-iap-receipt error', err);
    await captureEdgeException(err, {
      function: 'validate-iap-receipt',
      user_id: user?.id,
      platform,
      product_id: productId,
    });
    return new Response(
      JSON.stringify({ error: 'internal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
