import client from "./client";
import type { CommissionRate, CommissionRateCreate, CommissionRateUpdate, Product, ProductCreate, ProductList, ProductUpdate } from "../types";

export async function listProducts(page = 1, size = 10, search?: string): Promise<ProductList> {
  const params: Record<string, string | number> = { page, size };
  if (search) params.search = search;
  const { data } = await client.get<ProductList>("/v1/products", { params });
  return data;
}

export async function createProduct(payload: ProductCreate): Promise<Product> {
  const { data } = await client.post<Product>("/v1/products", payload);
  return data;
}

export async function updateProduct(productId: number, payload: ProductUpdate): Promise<Product> {
  const { data } = await client.put<Product>(`/v1/products/${productId}`, payload);
  return data;
}

export async function deleteProduct(productId: number): Promise<void> {
  await client.delete<null>(`/v1/products/${productId}`);
}

export async function getProductCommissionRates(productId: number): Promise<CommissionRate[]> {
  const { data } = await client.get<CommissionRate[]>(`/v1/products/${productId}/commission-rates`);
  return data;
}

export async function createCommissionRate(productId: number, payload: CommissionRateCreate): Promise<CommissionRate> {
  const { data } = await client.post<CommissionRate>(`/v1/products/${productId}/commission-rates`, payload);
  return data;
}

export async function updateCommissionRate(productId: number, rateId: number, payload: CommissionRateUpdate): Promise<CommissionRate> {
  const { data } = await client.put<CommissionRate>(`/v1/products/${productId}/commission-rates/${rateId}`, payload);
  return data;
}

export async function deleteCommissionRate(productId: number, rateId: number): Promise<void> {
  await client.delete(`/v1/products/${productId}/commission-rates/${rateId}`);
}
