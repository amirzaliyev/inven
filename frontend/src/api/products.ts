import client from "./client";
import type { Product, ProductCreate, ProductList, ProductUpdate } from "../types";

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
