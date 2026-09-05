export interface Seller {
  id: number;
  shopDomain: string;
  storeName: string;
  delayMinutes: number;
  discountCode: string;
  discountPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SellerRow {
  id: number;
  shop_domain: string;
  store_name: string;
  delay_minutes: number;
  discount_code: string;
  discount_percent: number;
  created_at: Date;
  updated_at: Date;
}

export function mapSellerRow(row: SellerRow): Seller {
  return {
    id: row.id,
    shopDomain: row.shop_domain,
    storeName: row.store_name,
    delayMinutes: row.delay_minutes,
    discountCode: row.discount_code,
    discountPercent: row.discount_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
