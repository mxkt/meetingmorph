export interface Env {
  SESSIONS: KVNamespace;
  PRODUCTS: KVNamespace;
  PURCHASES: KVNamespace;
  RATELIMIT: KVNamespace;
  ENVIRONMENT: string;
  LEMON_SQUEEZY_API_KEY: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET: string;
  LEMON_SQUEEZY_STORE_ID: string;
  LEMON_SQUEEZY_CHECKOUT_URL: string;
  LEMON_SQUEEZY_PRODUCT_ID: string;
}

export interface Session {
  userId: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Product {
  productId: string;
  name: string;
  priceUsd: number;
  lsProductId: string;
  lsVariantId: string;
  checkoutUrl: string;
  isActive: boolean;
}

export interface Purchase {
  userId: string;
  productId: string;
  orderId: string;
  status: 'completed' | 'refunded' | 'cancelled';
  purchasedAt: string;
  lsOrderId: string;
}

export interface RateLimitEntry {
  count: number;
  windowStart: string;
}

export interface ActionItem {
  title: string;
  assignee: string | null;
  priority: 'high' | 'medium' | 'low';
  deadline: string | null;
  description: string;
}

export interface ParseResult {
  actionItems: ActionItem[];
  summary: string;
  parsedAt: string;
}

export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}
