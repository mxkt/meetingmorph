import { Env, Purchase } from '../lib/types';
import { authMiddleware, AuthContext } from '../middleware/auth';

/**
 * GET /api/purchases/:userId
 * Check if user has an active purchase.
 */
export async function handleGetPurchases(
  request: Request,
  userId: string,
  env: Env
): Promise<Response> {
  // Auth check
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }
  const authContext = authResult as AuthContext;

  // Users can only check their own purchases
  if (authContext.userId !== userId) {
    return new Response(
      JSON.stringify({ error: 'forbidden', message: 'Cannot access other users purchases.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const productId = env.LEMON_SQUEEZY_PRODUCT_ID || 'default';
  const purchase = await env.PURCHASES.get(
    `purchases:${userId}:${productId}`,
    'json'
  ) as Purchase | null;

  return new Response(
    JSON.stringify({
      hasPurchase: purchase?.status === 'completed',
      purchase: purchase || null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
