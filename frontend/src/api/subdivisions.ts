import client from "./client";
import type { SubDivision, SubDivisionCreate, SubDivisionList, SubDivisionMember, SubDivisionUpdate } from "../types";

export async function listSubdivisions(page = 1, size = 10, search?: string): Promise<SubDivisionList> {
  const params: Record<string, string | number> = { page, size };
  if (search) params.search = search;
  const { data } = await client.get<SubDivisionList>("/v1/subdivisions", { params });
  return data;
}

export async function createSubdivision(payload: SubDivisionCreate): Promise<SubDivision> {
  const { data } = await client.post<SubDivision>("/v1/subdivisions", payload);
  return data;
}

export async function getSubdivision(id: number): Promise<SubDivision> {
  const { data } = await client.get<SubDivision>(`/v1/subdivisions/${id}`);
  return data;
}

export async function updateSubdivision(id: number, payload: SubDivisionUpdate): Promise<SubDivision> {
  const { data } = await client.put<SubDivision>(`/v1/subdivisions/${id}`, payload);
  return data;
}

export async function deleteSubdivision(id: number): Promise<void> {
  await client.delete(`/v1/subdivisions/${id}`);
}

export async function addMember(subdivisionId: number, payload: { employee_id: number }): Promise<SubDivisionMember> {
  const { data } = await client.post<SubDivisionMember>(`/v1/subdivisions/${subdivisionId}/members`, payload);
  return data;
}

export async function removeMember(subdivisionId: number, memberId: number): Promise<void> {
  await client.delete(`/v1/subdivisions/${subdivisionId}/members/${memberId}`);
}
