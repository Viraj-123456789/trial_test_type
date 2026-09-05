export interface Order {
  id: number;
  sellerId: number;
  checkoutId: string;
  orderNumber: string;
  totalPrice: string;
  currency: string;
  createdAt: Date;
}

interface OrderRow {
  id: number;
  seller_id: number;
  checkout_id: string;
  order_number: string;
  total_price: string;
  currency: string;
  created_at: Date;
}

export function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    sellerId: row.seller_id,
    checkoutId: row.checkout_id,
    orderNumber: row.order_number,
    totalPrice: row.total_price,
    currency: row.currency,
    createdAt: row.created_at,
  };
}
