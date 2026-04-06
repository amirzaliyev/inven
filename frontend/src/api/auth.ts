import client from "./client";
import type { TokenResponse, UserCredentials } from "../types";

export async function login(credentials: UserCredentials): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/v1/auth/token", credentials);
  return data;
}

export async function logout(): Promise<void> {
  await client.post("/v1/auth/logout");
}
