import { Env } from '../lib/types';
import { authMiddleware, purchaseGate, AuthContext } from '../middleware/auth';
import { parseTranscript, formatForLinear, formatForJira } from '../lib/parser';

/**
 * GET /api/export/linear?transcript=...
 * Format parsed action items for Linear API.
 */
export async function handleExportLinear(
  request: Request,
  env: Env
): Promise<Response> {
  // Auth + purchase gate
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const authContext = authResult as AuthContext;

  const gateResult = await purchaseGate(authContext, env);
  if (gateResult) return gateResult;

  const url = new URL(request.url);
  const transcript = url.searchParams.get('transcript');

  if (!transcript) {
    return new Response(
      JSON.stringify({ error: 'missing_param', message: 'transcript query parameter is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = parseTranscript(decodeURIComponent(transcript));
  const linearPayload = formatForLinear(result.actionItems);

  return new Response(
    JSON.stringify(linearPayload),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /api/export/jira?transcript=...
 * Format parsed action items for Jira API.
 */
export async function handleExportJira(
  request: Request,
  env: Env
): Promise<Response> {
  // Auth + purchase gate
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const authContext = authResult as AuthContext;

  const gateResult = await purchaseGate(authContext, env);
  if (gateResult) return gateResult;

  const url = new URL(request.url);
  const transcript = url.searchParams.get('transcript');

  if (!transcript) {
    return new Response(
      JSON.stringify({ error: 'missing_param', message: 'transcript query parameter is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = parseTranscript(decodeURIComponent(transcript));
  const jiraPayload = formatForJira(result.actionItems);

  return new Response(
    JSON.stringify(jiraPayload),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
