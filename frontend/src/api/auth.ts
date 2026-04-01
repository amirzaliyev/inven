import client from "./client";
import type { TokenResponse, UserCredentials } from "../types";

export async function login(credentials: UserCredentials): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/v1/auth/token", credentials);
  return data;
}
