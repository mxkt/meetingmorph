import { Env, Session } from '../lib/types';

/**
 * POST /api/auth/session
 * Create or retrieve a session by email.
 */
export async function handleCreateSession(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as { email?: string };

    if (!body.email || typeof body.email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'Email is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'invalid_email', message: 'Invalid email format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate user ID from email (deterministic hash)
    const userId = await hashString(email);
    const sessionId = await generateSessionId();

    const now = new Date().toISOString();
    const session: Session = {
      userId,
      email,
      createdAt: now,
      lastActiveAt: now,
    };

    // Store session in KV with 24-hour TTL
    await env.SESSIONS.put(`sessions:${sessionId}`, JSON.stringify(session), {
      expirationTtl: 86400,
    });

    return new Response(
      JSON.stringify({ sessionId, userId }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `mm_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'server_error', message: 'Failed to create session.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/auth/session/:id
 * Validate an existing session.
 */
export async function handleGetSession(
  sessionId: string,
  env: Env
): Promise<Response> {
  const session = await env.SESSIONS.get(`sessions:${sessionId}`, 'json') as Session | null;

  if (!session) {
    return new Response(
      JSON.stringify({ valid: false, userId: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ valid: true, userId: session.userId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

async function generateSessionId(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
