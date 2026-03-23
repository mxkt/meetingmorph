import { Env, Purchase } from '../lib/types';
import { verifyLemonSqueezyWebhook } from '../middleware/lemonSqueezy';

/**
 * POST /api/webhooks/ls
 * Handle LemonSqueezy webhook events.
 * LS Integration: Receives order_created, subscription_created, subscription_updated, subscription_cancelled
 * HMAC-SHA256 signature verified via X-Signature header.
 */
export async function handleLemonSqueezyWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify webhook signature (HMAC-SHA256 via X-Signature header)
  const verificationResult = await verifyLemonSqueezyWebhook(request, env);

  if (verificationResult instanceof Response) {
    return verificationResult; // Signature verification failed
  }

  const payload = verificationResult;
  const eventName = payload.meta.event_name;
  const userId = payload.meta.custom_data?.user_id;

  if (!userId) {
    console.error('Webhook payload missing user_id in custom_data');
    return new Response(
      JSON.stringify({ received: true, warning: 'No user_id in custom_data' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const productId = env.LEMON_SQUEEZY_PRODUCT_ID || 'default';
  const purchaseKey = `purchases:${userId}:${productId}`;

  switch (eventName) {
    case 'order_created': {
      const purchase: Purchase = {
        userId,
        productId,
        orderId: payload.data.id,
        status: 'completed',
        purchasedAt: new Date().toISOString(),
        lsOrderId: payload.data.id,
      };
      await env.PURCHASES.put(purchaseKey, JSON.stringify(purchase));
      console.log(`Purchase recorded: ${purchaseKey}`);
      break;
    }

    case 'subscription_created': {
      const purchase: Purchase = {
        userId,
        productId,
        orderId: payload.data.id,
        status: 'completed',
        purchasedAt: new Date().toISOString(),
        lsOrderId: payload.data.id,
      };
      await env.PURCHASES.put(purchaseKey, JSON.stringify(purchase));
      console.log(`Subscription created: ${purchaseKey}`);
      break;
    }

    case 'subscription_updated': {
      const existing = await env.PURCHASES.get(purchaseKey, 'json') as Purchase | null;
      if (existing) {
        existing.status = 'completed';
        await env.PURCHASES.put(purchaseKey, JSON.stringify(existing));
      }
      console.log(`Subscription updated: ${purchaseKey}`);
      break;
    }

    case 'subscription_cancelled': {
      const existing = await env.PURCHASES.get(purchaseKey, 'json') as Purchase | null;
      if (existing) {
        existing.status = 'cancelled';
        await env.PURCHASES.put(purchaseKey, JSON.stringify(existing));
      }
      console.log(`Subscription cancelled: ${purchaseKey}`);
      break;
    }

    default:
      console.log(`Unhandled webhook event: ${eventName}`);
  }

  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
