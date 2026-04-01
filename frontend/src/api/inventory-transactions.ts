import client from "./client";
import type { InventoryTransaction, InventoryTransactionCreate } from "../types";

export async function createInventoryTransaction(
  payload: InventoryTransactionCreate
): Promise<InventoryTransaction> {
  const { data } = await client.post<InventoryTransaction>("/v1/inventory-transactions", payload);
  return data;
}
