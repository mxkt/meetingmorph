/**
 * GET /api/health
 * Health check endpoint. No auth required.
 */
export function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'meetingmorph',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
