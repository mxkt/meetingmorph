import { Env } from '../lib/types';
import { AuthContext, authMiddleware, purchaseGate } from '../middleware/auth';
import { parseTranscript } from '../lib/parser';

/**
 * POST /api/parse
 * Parse meeting transcript into structured action items.
 * Requires auth + active purchase.
 */
export async function handleParse(
  request: Request,
  env: Env
): Promise<Response> {
  // Auth check
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }
  const authContext = authResult as AuthContext;

  // Purchase gate
  const gateResult = await purchaseGate(authContext, env);
  if (gateResult) {
    return gateResult;
  }

  try {
    const body = await request.json() as { transcript?: string; format?: string };

    if (!body.transcript || typeof body.transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'Transcript text is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.transcript.length > 100000) {
      return new Response(
        JSON.stringify({ error: 'payload_too_large', message: 'Transcript exceeds 100,000 character limit.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const format = body.format || 'json';
    const validFormats = ['json', 'markdown', 'linear', 'jira'];
    if (!validFormats.includes(format)) {
      return new Response(
        JSON.stringify({ error: 'invalid_format', message: `Format must be one of: ${validFormats.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = parseTranscript(body.transcript);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'parse_error', message: 'Failed to parse transcript.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
