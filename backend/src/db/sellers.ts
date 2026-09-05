import { pool } from './pool';
import { Seller, mapSellerRow } from '../models/seller';

export async function findSellerByShopDomain(shopDomain: string): Promise<Seller | null> {
  const { rows } = await pool.query('SELECT * FROM sellers WHERE shop_domain = $1', [shopDomain]);
  return rows[0] ? mapSellerRow(rows[0]) : null;
}

export async function findSellerById(id: number): Promise<Seller | null> {
  const { rows } = await pool.query('SELECT * FROM sellers WHERE id = $1', [id]);
  return rows[0] ? mapSellerRow(rows[0]) : null;
}
