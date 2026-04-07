import client from "./client";
import type { Order, OrderCreate, OrderList, OrderUpdate } from "../types";

interface ListOrdersParams {
  page: number;
  size: number;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  price_from?: number;
  price_to?: number;
}

export async function listOrders(params: ListOrdersParams): Promise<OrderList> {
  const query: Record<string, unknown> = { page: params.page, size: params.size };
  if (params.customer_id) query.customer_id = params.customer_id;
  if (params.date_from) query.date_from = params.date_from;
  if (params.date_to) query.date_to = params.date_to;
  if (params.price_from) query.price_from = params.price_from;
  if (params.price_to) query.price_to = params.price_to;
  const { data } = await client.get<OrderList>("/v1/orders", { params: query });
  return data;
}

export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await client.post<Order>("/v1/orders", payload);
  return data;
}

export async function updateOrder(orderId: number, payload: OrderUpdate): Promise<Order> {
  const { data } = await client.put<Order>(`/v1/orders/${orderId}`, payload);
  return data;
}

export async function completeOrder(orderId: number): Promise<Order> {
  const { data } = await client.post<Order>(`/v1/orders/${orderId}/complete`);
  return data;
}

export async function resetOrder(orderId: number): Promise<Order> {
  const { data } = await client.post<Order>(`/v1/orders/${orderId}/reset`);
  return data;
}

export async function cancelOrder(orderId: number): Promise<Order> {
  const { data } = await client.post<Order>(`/v1/orders/${orderId}/cancel`);
  return data;
}
