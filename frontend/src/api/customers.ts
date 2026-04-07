import client from "./client";
import type { Customer, CustomerCreate, CustomerList, CustomerUpdate } from "../types";

export async function listCustomers(
  page: number,
  size: number,
  search?: string
): Promise<CustomerList> {
  const params: Record<string, unknown> = { page, size };
  if (search) params.search = search;
  const { data } = await client.get<CustomerList>("/v1/customers", { params });
  return data;
}

export async function getCustomer(customerId: number): Promise<Customer> {
  const { data } = await client.get<Customer>(`/v1/customers/${customerId}`);
  return data;
}

export async function createCustomer(payload: CustomerCreate): Promise<Customer> {
  const { data } = await client.post<Customer>("/v1/customers", payload);
  return data;
}

export async function updateCustomer(
  customerId: number,
  payload: CustomerUpdate
): Promise<Customer> {
  const { data } = await client.put<Customer>(`/v1/customers/${customerId}`, payload);
  return data;
}

export async function deleteCustomer(customerId: number): Promise<void> {
  await client.delete(`/v1/customers/${customerId}`);
}
