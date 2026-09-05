export interface FixtureCustomer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface FixtureProduct {
  product_id: number;
  variant_id: number;
  title: string;
  price: string;
  sku: string;
}

// Small, fixed demo pool — enough variety to make the dashboard/demo feel real
// without needing real Shopify data. See structure.md: "Simulate a different
// cart-abandonment scenario for testing".
export const CUSTOMERS: FixtureCustomer[] = [
  { first_name: 'Jamie', last_name: 'Rivera', email: 'jamie.rivera@example.com', phone: '+15551230001' },
  { first_name: 'Priya', last_name: 'Nair', email: 'priya.nair@example.com', phone: '+15551230002' },
  { first_name: 'Marco', last_name: 'Silva', email: 'marco.silva@example.com', phone: '+15551230003' },
];

export const PRODUCTS: FixtureProduct[] = [
  { product_id: 111222001, variant_id: 222333001, title: 'Classic Leather Backpack', price: '119.99', sku: 'BLB-001' },
  { product_id: 111222002, variant_id: 222333002, title: 'Wireless Noise-Cancelling Headphones', price: '89.50', sku: 'WNH-014' },
  { product_id: 111222003, variant_id: 222333003, title: 'Ceramic Pour-Over Coffee Set', price: '34.00', sku: 'CPC-007' },
];

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
