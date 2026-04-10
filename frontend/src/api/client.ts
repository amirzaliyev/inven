import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { TokenResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh token logic
let refreshPromise: Promise<TokenResponse> | null = null;

async function refreshTokens(): Promise<TokenResponse> {
  // Refresh token is sent automatically via httpOnly cookie
  const { data } = await axios.post<TokenResponse>(
    `${API_URL}/v1/auth/refresh`,
    null,
    { withCredentials: true },
  );
  localStorage.setItem("access_token", data.access_token);
  return data;
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshTokens().finally(() => {
            refreshPromise = null;
          });
        }
        const tokens = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return client(originalRequest);
      } catch {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default client;
