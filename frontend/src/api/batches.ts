import client from "./client";
import type { Batch, BatchCreate, BatchList, BatchUpdate } from "../types";

export async function createBatch(payload: BatchCreate): Promise<Batch> {
  const { data } = await client.post<Batch>("/v1/batches", payload);
  return data;
}

export async function listBatches(page = 1, size = 10): Promise<BatchList> {
  const { data } = await client.get<BatchList>("/v1/batches", {
    params: { page, size },
  });
  return data;
}

export async function updateBatch(batchId: number, payload: BatchUpdate): Promise<Batch> {
  const { data } = await client.put<Batch>(`/v1/batches/${batchId}`, payload);
  return data;
}

export async function confirmBatch(batchId: number): Promise<Batch> {
  const { data } = await client.patch<Batch>(`/v1/batches/${batchId}`);
  return data;
}
