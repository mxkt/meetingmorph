import { Env } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { AuthContext } from '../middleware/auth';

/**
 * POST /api/checkout
 * Create a LemonSqueezy checkout session.
 * LS Integration: Creates checkout via POST /v1/checkouts
 */
export async function handleCheckout(
  request: Request,
  env: Env
): Promise<Response> {
  // Auth check
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }
  const authContext = authResult as AuthContext;

  try {
    const body = await request.json() as { userId?: string; productId?: string };
    const userId = body.userId || authContext.userId;
    const productId = body.productId || env.LEMON_SQUEEZY_PRODUCT_ID;

    // Look up product variant from KV
    const product = await env.PRODUCTS.get(`products:${productId}`, 'json') as { lsVariantId?: string } | null;
    const variantId = product?.lsVariantId;

    if (!variantId && !env.LEMON_SQUEEZY_CHECKOUT_URL) {
      return new Response(
        JSON.stringify({ error: 'product_not_found', message: 'Product configuration is missing.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If we have a variant ID, create a dynamic checkout via LS API
    if (variantId && env.LEMON_SQUEEZY_API_KEY) {
      const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${env.LEMON_SQUEEZY_API_KEY}`,
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                custom: { user_id: userId },
              },
            },
            relationships: {
              store: {
                data: { type: 'stores', id: env.LEMON_SQUEEZY_STORE_ID },
              },
              variant: {
                data: { type: 'variants', id: variantId },
              },
            },
          },
        }),
      });

      if (!lsResponse.ok) {
        console.error('LemonSqueezy checkout creation failed:', await lsResponse.text());
        // Fall back to static checkout URL
        return new Response(
          JSON.stringify({ checkoutUrl: env.LEMON_SQUEEZY_CHECKOUT_URL }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const lsData = await lsResponse.json() as { data?: { attributes?: { url?: string } } };
      const checkoutUrl = lsData?.data?.attributes?.url || env.LEMON_SQUEEZY_CHECKOUT_URL;

      return new Response(
        JSON.stringify({ checkoutUrl }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fallback to static checkout URL
    return new Response(
      JSON.stringify({ checkoutUrl: env.LEMON_SQUEEZY_CHECKOUT_URL }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'checkout_error', message: 'Failed to create checkout.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
