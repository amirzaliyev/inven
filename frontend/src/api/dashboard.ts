import client from "./client";
import type { DashboardData, DashboardTimeseries, TimeseriesRange } from "../types";

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>("/v1/dashboard");
  return data;
}

export async function getDashboardTimeseries(
  days: TimeseriesRange,
): Promise<DashboardTimeseries> {
  const { data } = await client.get<DashboardTimeseries>("/v1/dashboard/timeseries", {
    params: { days },
  });
  return data;
}
