import client from "./client";
import type { InventoryTransaction, InventoryTransactionCreate, InventoryTransactionList } from "../types";
import { TransactionType, SourceType } from "../types";

export async function createInventoryTransaction(
  payload: InventoryTransactionCreate
): Promise<InventoryTransaction> {
  const { data } = await client.post<InventoryTransaction>("/v1/inventory-transactions", payload);
  return data;
}

export async function listInventoryTransactions(
  page: number,
  size: number,
  transaction_type?: TransactionType,
  source_type?: SourceType
): Promise<InventoryTransactionList> {
  const params: Record<string, unknown> = { page, size };
  if (transaction_type) params.transaction_type = transaction_type;
  if (source_type) params.source_type = source_type;
  const { data } = await client.get<InventoryTransactionList>("/v1/inventory-transactions", { params });
  return data;
}
