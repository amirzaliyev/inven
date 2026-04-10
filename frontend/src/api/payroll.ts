import client from "./client";
import type { PayrollList, PayrollResponse, PayrollStatus, Payslip } from "../types";

export async function generatePayroll(payload: { period_start: string; period_end: string }): Promise<PayrollResponse> {
  const { data } = await client.post<PayrollResponse>("/v1/payroll", payload);
  return data;
}

export async function listPayroll(page = 1, size = 10, status?: PayrollStatus): Promise<PayrollList> {
  const params: Record<string, string | number> = { page, size };
  if (status) params.status = status;
  const { data } = await client.get<PayrollList>("/v1/payroll", { params });
  return data;
}

export async function getPayroll(id: number): Promise<PayrollResponse> {
  const { data } = await client.get<PayrollResponse>(`/v1/payroll/${id}`);
  return data;
}

export async function approvePayroll(id: number): Promise<PayrollResponse> {
  const { data } = await client.post<PayrollResponse>(`/v1/payroll/${id}/approve`);
  return data;
}

export async function markPayrollPaid(id: number): Promise<PayrollResponse> {
  const { data } = await client.post<PayrollResponse>(`/v1/payroll/${id}/mark-paid`);
  return data;
}

export async function getPayslip(id: number): Promise<Payslip> {
  const { data } = await client.get<Payslip>(`/v1/payroll/payslips/${id}`);
  return data;
}
