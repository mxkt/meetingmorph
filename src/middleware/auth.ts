import { Env, Session, Purchase } from '../lib/types';

export interface AuthContext {
  userId: string;
  session: Session;
  hasPurchase: boolean;
}

/**
 * Extract session ID from request (cookie or Authorization header)
 */
function getSessionId(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('mm_session='));
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }

  return null;
}

/**
 * Auth middleware - validates session and checks purchase status.
 * Returns AuthContext if valid, or a Response (401/402) if not.
 */
export async function authMiddleware(
  request: Request,
  env: Env
): Promise<AuthContext | Response> {
  const sessionId = getSessionId(request);

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'auth_required', message: 'No session found. Please authenticate first.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Look up session in KV
  const sessionData = await env.SESSIONS.get(`sessions:${sessionId}`, 'json') as Session | null;

  if (!sessionData) {
    return new Response(
      JSON.stringify({ error: 'session_expired', message: 'Session not found or expired.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Update last active timestamp
  const updatedSession: Session = {
    ...sessionData,
    lastActiveAt: new Date().toISOString(),
  };
  await env.SESSIONS.put(`sessions:${sessionId}`, JSON.stringify(updatedSession), { expirationTtl: 86400 });

  // Check purchase status in KV
  const productId = env.LEMON_SQUEEZY_PRODUCT_ID || 'default';
  const purchaseData = await env.PURCHASES.get(
    `purchases:${sessionData.userId}:${productId}`,
    'json'
  ) as Purchase | null;

  const hasPurchase = purchaseData?.status === 'completed';

  return {
    userId: sessionData.userId,
    session: updatedSession,
    hasPurchase,
  };
}

/**
 * Purchase gate - requires a completed purchase to proceed.
 * Returns null if authorized, or a 402 Response if not.
 */
export async function purchaseGate(
  authContext: AuthContext,
  env: Env
): Promise<Response | null> {
  if (authContext.hasPurchase) {
    return null; // Authorized
  }

  const checkoutUrl = env.LEMON_SQUEEZY_CHECKOUT_URL || '';
  return new Response(
    JSON.stringify({
      error: 'purchase_required',
      message: 'A purchase is required to access this feature.',
      checkoutUrl,
    }),
    { status: 402, headers: { 'Content-Type': 'application/json' } }
  );
}
