import { Env, LemonSqueezyWebhookPayload } from '../lib/types';

/**
 * Verify LemonSqueezy webhook HMAC-SHA256 signature.
 * Uses the X-Signature header and LEMON_SQUEEZY_WEBHOOK_SECRET env var.
 *
 * @returns The parsed payload if signature is valid, or a 401 Response if invalid.
 */
export async function verifyLemonSqueezyWebhook(
  request: Request,
  env: Env
): Promise<LemonSqueezyWebhookPayload | Response> {
  const signature = request.headers.get('X-Signature');

  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'missing_signature', message: 'X-Signature header is required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const secret = env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('LEMON_SQUEEZY_WEBHOOK_SECRET is not configured');
    return new Response(
      JSON.stringify({ error: 'server_error', message: 'Webhook secret not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Read the raw body for HMAC verification
  const rawBody = await request.text();

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(computedSignature, signature)) {
    return new Response(
      JSON.stringify({ error: 'invalid_signature', message: 'Webhook signature verification failed.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse and return the verified payload
  try {
    const payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
    return payload;
  } catch {
    return new Response(
      JSON.stringify({ error: 'invalid_payload', message: 'Could not parse webhook payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
