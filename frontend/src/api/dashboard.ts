import client from "./client";
import type { DashboardData } from "../types";

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>("/v1/dashboard");
  return data;
}
