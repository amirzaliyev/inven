import client from "./client";
import type {
  UserList,
  UserResponse,
  UserCreate,
  UserUpdate,
  AdminPasswordReset,
} from "../types";

export async function listUsers(
  page = 1,
  size = 10,
  search?: string,
  role?: string,
): Promise<UserList> {
  const params: Record<string, unknown> = { page, size };
  if (search) params.search = search;
  if (role) params.role = role;
  const { data } = await client.get<UserList>("/v1/users", { params });
  return data;
}

export async function getUser(id: number): Promise<UserResponse> {
  const { data } = await client.get<UserResponse>(`/v1/users/${id}`);
  return data;
}

export async function createUser(payload: UserCreate): Promise<UserResponse> {
  const { data } = await client.post<UserResponse>("/v1/users", payload);
  return data;
}

export async function updateUser(id: number, payload: UserUpdate): Promise<UserResponse> {
  const { data } = await client.put<UserResponse>(`/v1/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await client.delete(`/v1/users/${id}`);
}

export async function resetPassword(
  userId: number,
  payload: AdminPasswordReset,
): Promise<void> {
  await client.post(`/v1/users/${userId}/reset-password`, payload);
}
