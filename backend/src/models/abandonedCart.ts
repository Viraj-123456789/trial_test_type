export type CartStatus = 'pending' | 'sent' | 'recovered' | 'expired' | 'failed';

export interface AbandonedCart {
  id: number;
  sellerId: number;
  checkoutId: string;
  customerName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  // kept as a string (NUMERIC comes back from pg as text) to avoid float rounding on money
  cartTotal: string;
  currency: string;
  checkoutUrl: string;
  lineItems: unknown;
  status: CartStatus;
  sentAt: Date | null;
  recoveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AbandonedCartRow {
  id: number;
  seller_id: number;
  checkout_id: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  cart_total: string;
  currency: string;
  checkout_url: string;
  line_items: unknown;
  status: CartStatus;
  sent_at: Date | null;
  recovered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function mapAbandonedCartRow(row: AbandonedCartRow): AbandonedCart {
  return {
    id: row.id,
    sellerId: row.seller_id,
    checkoutId: row.checkout_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    cartTotal: row.cart_total,
    currency: row.currency,
    checkoutUrl: row.checkout_url,
    lineItems: row.line_items,
    status: row.status,
    sentAt: row.sent_at,
    recoveredAt: row.recovered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
